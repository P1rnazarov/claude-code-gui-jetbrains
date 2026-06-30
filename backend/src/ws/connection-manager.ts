import type { WebSocket } from 'ws';
import type { ChildProcess } from 'child_process';
import type { IPCMessage, NativeDropEntry } from '../core/types';
import { ClientEnv, MessageType } from '../shared';

const SESSION_CLEANUP_GRACE_MS = 30_000;
const IDLE_SHUTDOWN_GRACE_MS = 60_000;
/**
 * How long after the last JSONL append a session is still considered "running".
 * Generous enough to bridge pauses between streamed messages / tool calls so the
 * indicator doesn't flicker, short enough to clear soon after a session goes idle.
 */
export const SESSION_ACTIVITY_WINDOW_MS = 20_000;
export const SESSION_ACTIVITY_SWEEP_MS = 5_000;
/**
 * How long an editor-context payload stays valid while waiting for a webview to
 * connect. The "Add to Claude" action can fire before the JCEF panel has opened
 * its /ws socket (cold start); we stash the payload and replay it to the first
 * connection that arrives, but only within this window so a stale selection from
 * minutes ago is never injected.
 */
const PENDING_EDITOR_CONTEXT_TTL_MS = 10_000;

/** Push message type carrying the IDE editor selection to the webview. */
export const EDITOR_CONTEXT_MESSAGE = MessageType.EDITOR_CONTEXT;

interface PendingEditorContext {
  payload: Record<string, unknown>;
  expiresAt: number;
}

interface SessionRecord {
  sessionId: string;
  process: ChildProcess | null;
  subscribers: Set<string>;
  buffer: string;
  workingDir: string;
}

interface ClientRecord {
  subscribedSessionId: string | null;
  env: ClientEnv;
  /**
   * IDE panel that owns this webview connection (JetBrains mode only). Set from the
   * `panelId` query param that Kotlin embeds in the JCEF URL. Used to route panel-
   * scoped notifications (e.g. NATIVE_DROP) to the exact webview the user is looking
   * at, independent of sessionId which the webview generates itself.
   */
  panelId: string | null;
  /**
   * Native drop paths stashed by CefDragHandler.onDragEnter, waiting for the page-level
   * drop event to flush them. JCEF doesn't expose absolute paths on `dataTransfer` for
   * security reasons, so we receive the paths over the /rpc socket on drag-enter, hold
   * them here, and release them on NATIVE_DROP_FLUSH (which the webview fires from its
   * own `drop` handler). Cleared on flush and on disconnect.
   */
  nativeDropStash: NativeDropEntry[] | null;
}

export class ConnectionManager {
  private connectionMap = new Map<string, WebSocket>();
  private clientMap = new Map<string, ClientRecord>();
  private sessionRegistry = new Map<string, SessionRecord>();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();
  private idleShutdownTimer: NodeJS.Timeout | null = null;
  // Secondary index for O(1) panelId → connectionId resolution. Panel ↔ connection
  // is 1:1 (one JCEF browser per IDE panel, one /ws socket per browser), so this
  // map is always in sync with the panelId stored on each ClientRecord.
  private panelIdIndex = new Map<string, string>();
  // Editor context awaiting a webview connection. Replayed to the first
  // connection that arrives within PENDING_EDITOR_CONTEXT_TTL_MS, then cleared.
  private pendingEditorContext: PendingEditorContext | null = null;
  // sessionId → last JSONL append timestamp. A session whose history file is
  // being actively appended counts as "running" even when no process is owned
  // here (external terminal sessions / live-tailed sessions). Marked by the
  // jsonl watcher's onAppend; expired by activitySweepTimer.
  private sessionActivity = new Map<string, number>();
  private activitySweepTimer: NodeJS.Timeout | null = null;
  private nextId = 0;

  // ─── Connection lifecycle ───────────────────────────────────────────────────

  addConnection(ws: WebSocket, env: ClientEnv = ClientEnv.BROWSER, panelId: string | null = null): string {
    const connectionId = `conn-${++this.nextId}-${Date.now()}`;
    this.connectionMap.set(connectionId, ws);
    this.clientMap.set(connectionId, { subscribedSessionId: null, env, panelId, nativeDropStash: null });
    if (panelId) this.panelIdIndex.set(panelId, connectionId);
    this.cancelIdleShutdown();
    console.error(
      '[node-backend]',
      `Connection added: ${connectionId} (env: ${env}, panelId: ${panelId ?? 'none'})`,
    );

    // Replay any editor context that arrived before this webview connected
    // (e.g. "Add to Claude" fired during JCEF cold start).
    const pendingEditorContext = this.consumePendingEditorContext();
    if (pendingEditorContext) {
      this.sendTo(connectionId, EDITOR_CONTEXT_MESSAGE, pendingEditorContext);
    }

    return connectionId;
  }

  // ─── Editor context buffer ──────────────────────────────────────────────────

  /**
   * Stash an editor-context payload to replay to the next webview connection.
   * Overwrites any earlier pending payload — only the latest selection matters.
   */
  setPendingEditorContext(payload: Record<string, unknown>): void {
    this.pendingEditorContext = {
      payload,
      expiresAt: Date.now() + PENDING_EDITOR_CONTEXT_TTL_MS,
    };
  }

  /**
   * Return the stashed editor-context payload and clear the buffer. Returns null
   * if nothing is stashed or the stash has expired (also clears in that case).
   */
  consumePendingEditorContext(): Record<string, unknown> | null {
    const pending = this.pendingEditorContext;
    this.pendingEditorContext = null;
    if (!pending) return null;
    if (Date.now() > pending.expiresAt) return null;
    return pending.payload;
  }

  setNativeDropStash(panelId: string, entries: NativeDropEntry[]): boolean {
    const connectionId = this.panelIdIndex.get(panelId);
    if (!connectionId) return false;
    const record = this.clientMap.get(connectionId);
    if (!record) return false;
    record.nativeDropStash = entries;
    return true;
  }

  takeNativeDropStash(connectionId: string): NativeDropEntry[] | null {
    const record = this.clientMap.get(connectionId);
    if (!record || !record.nativeDropStash) return null;
    const stash = record.nativeDropStash;
    record.nativeDropStash = null;
    return stash;
  }

  /**
   * Resolve a panelId (assigned by Kotlin on JCEF browser creation) back to its
   * webview connection. Panel ↔ connection is 1:1 since each panel hosts one
   * JCEF browser that opens one /ws socket.
   */
  getConnectionIdByPanelId(panelId: string): string | null {
    return this.panelIdIndex.get(panelId) ?? null;
  }

  removeConnection(connectionId: string): void {
    this.unsubscribe(connectionId);
    const record = this.clientMap.get(connectionId);
    if (record?.panelId) this.panelIdIndex.delete(record.panelId);
    this.connectionMap.delete(connectionId);
    this.clientMap.delete(connectionId);
    console.error('[node-backend]', `Connection removed: ${connectionId}`);

    if (this.connectionMap.size === 0) {
      this.scheduleIdleShutdown();
    }
  }

  // ─── Messaging ──────────────────────────────────────────────────────────────

  sendTo(connectionId: string, type: string, payload: Record<string, unknown> = {}): void {
    const ws = this.connectionMap.get(connectionId);
    if (!ws) return;

    const message: IPCMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };

    try {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        ws.send(JSON.stringify(message));
      }
    } catch {
      // send failure — will be cleaned up on disconnect
    }
  }

  broadcastToSession(
    sessionId: string,
    type: string,
    payload: Record<string, unknown> = {},
    excludeConnectionId?: string,
  ): void {
    const session = this.sessionRegistry.get(sessionId);
    if (!session) return;

    const message: IPCMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(message);

    for (const connId of session.subscribers) {
      if (connId === excludeConnectionId) continue;
      const ws = this.connectionMap.get(connId);
      if (!ws) continue;

      try {
        if (ws.readyState === 1 /* WebSocket.OPEN */) {
          ws.send(data);
        }
      } catch {
        // send failure — will be cleaned up on disconnect
      }
    }
  }

  broadcastToAll(type: string, payload: Record<string, unknown> = {}): void {
    const message: IPCMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(message);

    for (const [, ws] of this.connectionMap) {
      try {
        if (ws.readyState === 1 /* WebSocket.OPEN */) {
          ws.send(data);
        }
      } catch {
        // send failure — will be cleaned up on disconnect
      }
    }
  }

  // ─── Subscription (Pub/Sub) ─────────────────────────────────────────────────

  subscribe(connectionId: string, sessionId: string): void {
    const client = this.clientMap.get(connectionId);
    // Already subscribed to the same session — no-op
    if (client?.subscribedSessionId === sessionId) {
      return;
    }

    // Unsubscribe from any DIFFERENT session first
    this.unsubscribe(connectionId);

    const session = this.getOrCreateSession(sessionId);
    session.subscribers.add(connectionId);

    // Cancel pending cleanup if reconnecting within grace period
    const pendingTimer = this.cleanupTimers.get(sessionId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.cleanupTimers.delete(sessionId);
      console.error(
        '[node-backend]',
        `Cancelled cleanup timer for session ${sessionId} (subscriber reconnected)`,
      );
    }

    if (client) {
      client.subscribedSessionId = sessionId;
    }

    console.error(
      '[node-backend]',
      `${connectionId} subscribed to session ${sessionId} (subscribers: ${session.subscribers.size})`,
    );
  }

  unsubscribe(connectionId: string): void {
    const client = this.clientMap.get(connectionId);
    if (!client?.subscribedSessionId) return;

    const sessionId = client.subscribedSessionId;
    const session = this.sessionRegistry.get(sessionId);

    if (session) {
      session.subscribers.delete(connectionId);
      console.error(
        '[node-backend]',
        `${connectionId} unsubscribed from session ${sessionId} (subscribers: ${session.subscribers.size})`,
      );

      if (session.subscribers.size === 0) {
        console.error(
          '[node-backend]',
          `Session ${sessionId} has no subscribers, scheduling cleanup in ${SESSION_CLEANUP_GRACE_MS}ms`,
        );
        const timer = setTimeout(() => {
          this.cleanupTimers.delete(sessionId);
          const currentSession = this.sessionRegistry.get(sessionId);
          if (currentSession && currentSession.subscribers.size === 0) {
            this.cleanupSession(sessionId);
          }
        }, SESSION_CLEANUP_GRACE_MS);
        this.cleanupTimers.set(sessionId, timer);
      }
    }

    client.subscribedSessionId = null;
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  getConnectionCount(): number {
    return this.connectionMap.size;
  }

  getClient(connectionId: string): ClientRecord | undefined {
    return this.clientMap.get(connectionId);
  }

  getClientEnv(connectionId: string): ClientEnv {
    return this.clientMap.get(connectionId)?.env ?? ClientEnv.BROWSER;
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessionRegistry.get(sessionId);
  }

  getOrCreateSession(sessionId: string, workingDir?: string): SessionRecord {
    let session = this.sessionRegistry.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        process: null,
        subscribers: new Set(),
        buffer: '',
        workingDir: workingDir ?? '',
      };
      this.sessionRegistry.set(sessionId, session);
    }
    return session;
  }

  // ─── Process accessors ─────────────────────────────────────────────────────

  /**
   * A session is "running" if either this backend owns a live process for it
   * (GUI-started) or its JSONL was appended within the activity window (external
   * / live-tailed sessions). Returns the union, deduplicated.
   */
  getRunningSessionIds(): string[] {
    const ids = new Set<string>();
    for (const s of this.sessionRegistry.values()) {
      if (s.process) ids.add(s.sessionId);
    }
    const now = Date.now();
    for (const [sessionId, ts] of this.sessionActivity) {
      if (now - ts < SESSION_ACTIVITY_WINDOW_MS) ids.add(sessionId);
    }
    return [...ids];
  }

  broadcastRunningSessions(): void {
    this.broadcastToAll(MessageType.RUNNING_SESSIONS, { sessionIds: this.getRunningSessionIds() });
  }

  setProcess(sessionId: string, proc: ChildProcess | null): void {
    const session = this.getOrCreateSession(sessionId);
    session.process = proc;
    if (proc) {
      // Promoted to an owned process: drop any external JSONL-activity tracking so
      // the running flag follows the process lifecycle. Otherwise a stale activity
      // timestamp could keep the session "running" for up to the activity window
      // after the owned process ends.
      this.sessionActivity.delete(sessionId);
    }
    this.broadcastRunningSessions();
  }

  /**
   * Record live JSONL append activity for a session (from the jsonl watcher).
   * Marks the session running for SESSION_ACTIVITY_WINDOW_MS and broadcasts only
   * on the idle→running transition; the sweep handles the running→idle edge.
   */
  markSessionActivity(sessionId: string): void {
    const wasRunning = this.sessionActivity.has(sessionId)
      && Date.now() - (this.sessionActivity.get(sessionId) ?? 0) < SESSION_ACTIVITY_WINDOW_MS;
    this.sessionActivity.set(sessionId, Date.now());
    this.ensureActivitySweep();
    if (!wasRunning) this.broadcastRunningSessions();
  }

  private ensureActivitySweep(): void {
    if (this.activitySweepTimer) return;
    this.activitySweepTimer = setInterval(() => {
      const now = Date.now();
      let expired = false;
      for (const [sessionId, ts] of this.sessionActivity) {
        if (now - ts >= SESSION_ACTIVITY_WINDOW_MS) {
          this.sessionActivity.delete(sessionId);
          expired = true;
        }
      }
      if (this.sessionActivity.size === 0 && this.activitySweepTimer) {
        clearInterval(this.activitySweepTimer);
        this.activitySweepTimer = null;
      }
      if (expired) this.broadcastRunningSessions();
    }, SESSION_ACTIVITY_SWEEP_MS);
    this.activitySweepTimer.unref?.();
  }

  getProcess(sessionId: string): ChildProcess | null {
    return this.sessionRegistry.get(sessionId)?.process ?? null;
  }

  setBuffer(sessionId: string, buffer: string): void {
    const session = this.sessionRegistry.get(sessionId);
    if (session) {
      session.buffer = buffer;
    }
  }

  getBuffer(sessionId: string): string {
    return this.sessionRegistry.get(sessionId)?.buffer ?? '';
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  shutdownAll(): void {
    // Clear all pending cleanup timers
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    this.cancelIdleShutdown();

    if (this.activitySweepTimer) {
      clearInterval(this.activitySweepTimer);
      this.activitySweepTimer = null;
    }
    this.sessionActivity.clear();

    let killedSessions = 0;
    let closedConnections = 0;

    for (const session of this.sessionRegistry.values()) {
      if (session.process) {
        session.process.kill('SIGTERM');
        killedSessions++;
      }
    }

    for (const ws of this.connectionMap.values()) {
      ws.close();
      closedConnections++;
    }

    this.sessionRegistry.clear();
    this.connectionMap.clear();
    this.clientMap.clear();
    this.panelIdIndex.clear();

    console.error(
      '[node-backend]',
      `Shutdown: killed ${killedSessions} session(s), closed ${closedConnections} connection(s)`,
    );
  }

  private scheduleIdleShutdown(): void {
    if (this.idleShutdownTimer !== null) return;

    console.error(
      '[node-backend]',
      `No active connections. Idle shutdown scheduled in ${IDLE_SHUTDOWN_GRACE_MS}ms`,
    );
    this.idleShutdownTimer = setTimeout(() => {
      console.error('[node-backend]', 'Idle shutdown grace period elapsed. Shutting down.');
      this.shutdownAll();
      process.exit(0);
    }, IDLE_SHUTDOWN_GRACE_MS);
  }

  private cancelIdleShutdown(): void {
    if (this.idleShutdownTimer === null) return;

    clearTimeout(this.idleShutdownTimer);
    this.idleShutdownTimer = null;
    console.error('[node-backend]', 'Idle shutdown timer cancelled (new connection received)');
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessionRegistry.get(sessionId);
    if (!session) return;

    if (session.process) {
      console.error(
        '[node-backend]',
        `Killing process for session ${sessionId} (PID: ${session.process.pid})`,
      );
      session.process.kill('SIGTERM');
      session.process = null;
    }

    this.sessionRegistry.delete(sessionId);
    console.error('[node-backend]', `Session ${sessionId} cleaned up`);
    this.broadcastRunningSessions();
  }
}
