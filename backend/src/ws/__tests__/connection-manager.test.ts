import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConnectionManager,
  SESSION_ACTIVITY_WINDOW_MS,
  SESSION_ACTIVITY_SWEEP_MS,
} from '../connection-manager';
import { ClientEnv } from '../../shared';
import { MessageType } from '../../shared';

function createMockWs(readyState = 1) {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as import('ws').WebSocket;
}

describe('ConnectionManager', () => {
  let cm: ConnectionManager;

  beforeEach(() => {
    cm = new ConnectionManager();
    vi.useFakeTimers();
  });

  describe('subscribe / unsubscribe', () => {
    it('should subscribe connection to session', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');

      const client = cm.getClient(connId);
      expect(client?.subscribedSessionId).toBe('sess-1');
    });

    it('should unsubscribe from previous session when subscribing to new one', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');
      cm.subscribe(connId, 'sess-2');

      const client = cm.getClient(connId);
      expect(client?.subscribedSessionId).toBe('sess-2');
    });

    it('should be no-op when subscribing to same session', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');
      cm.subscribe(connId, 'sess-1'); // no-op
      expect(cm.getClient(connId)?.subscribedSessionId).toBe('sess-1');
    });

    it('should unsubscribe and set subscribedSessionId to null', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');
      cm.unsubscribe(connId);
      expect(cm.getClient(connId)?.subscribedSessionId).toBeNull();
    });
  });

  describe('broadcastToSession', () => {
    it('should send to all subscribers of a session', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const conn1 = cm.addConnection(ws1);
      const conn2 = cm.addConnection(ws2);
      cm.subscribe(conn1, 'sess-1');
      cm.subscribe(conn2, 'sess-1');

      cm.broadcastToSession('sess-1', 'TEST_EVENT', { data: 'hello' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should exclude specified connection', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const conn1 = cm.addConnection(ws1);
      const conn2 = cm.addConnection(ws2);
      cm.subscribe(conn1, 'sess-1');
      cm.subscribe(conn2, 'sess-1');

      cm.broadcastToSession('sess-1', 'TEST_EVENT', {}, conn1);

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should be no-op for non-existent session', () => {
      cm.broadcastToSession('nonexistent', 'TEST_EVENT');
      // No exception
    });
  });

  describe('broadcastToAll', () => {
    it('should send to all connections', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      cm.addConnection(ws1);
      cm.addConnection(ws2);

      cm.broadcastToAll('GLOBAL_EVENT', { data: 'all' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should not send to closed connections', () => {
      const wsOpen = createMockWs(1);
      const wsClosed = createMockWs(3); // CLOSED
      cm.addConnection(wsOpen);
      cm.addConnection(wsClosed);

      cm.broadcastToAll('EVENT');

      expect(wsOpen.send).toHaveBeenCalled();
      expect(wsClosed.send).not.toHaveBeenCalled();
    });
  });

  describe('shutdownAll', () => {
    it('should kill all session processes and close all connections', () => {
      const ws = createMockWs();
      cm.addConnection(ws);
      const mockProcess = { kill: vi.fn() } as unknown as import('child_process').ChildProcess;
      cm.setProcess('sess-1', mockProcess);

      cm.shutdownAll();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(ws.close).toHaveBeenCalled();
    });
  });

  describe('session process management', () => {
    it('should set and get process for session', () => {
      const proc = { kill: vi.fn() } as unknown as import('child_process').ChildProcess;
      cm.getOrCreateSession('sess-1');
      cm.setProcess('sess-1', proc);
      expect(cm.getProcess('sess-1')).toBe(proc);
    });

    it('should return null for non-existent session process', () => {
      expect(cm.getProcess('nonexistent')).toBeNull();
    });
  });

  describe('buffer management', () => {
    it('should set and get buffer', () => {
      cm.getOrCreateSession('sess-1');
      cm.setBuffer('sess-1', 'partial data');
      expect(cm.getBuffer('sess-1')).toBe('partial data');
    });

    it('should return empty string for non-existent session buffer', () => {
      expect(cm.getBuffer('nonexistent')).toBe('');
    });
  });

  describe('getConnectionCount', () => {
    it('should return 0 when there are no connections', () => {
      expect(cm.getConnectionCount()).toBe(0);
    });

    it('should reflect the number of active connections', () => {
      cm.addConnection(createMockWs());
      cm.addConnection(createMockWs());
      expect(cm.getConnectionCount()).toBe(2);
    });

    it('should decrease when a connection is removed', () => {
      const connId = cm.addConnection(createMockWs());
      cm.addConnection(createMockWs());
      cm.removeConnection(connId);
      expect(cm.getConnectionCount()).toBe(1);
    });
  });

  describe('pending editor context buffer', () => {
    it('should return the stashed payload on consume', () => {
      const payload = { absolutePath: '/abs/src/file.ts', relativePath: 'src/file.ts' };
      cm.setPendingEditorContext(payload);
      expect(cm.consumePendingEditorContext()).toEqual(payload);
    });

    it('should clear the buffer after a single consume', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      cm.consumePendingEditorContext();
      expect(cm.consumePendingEditorContext()).toBeNull();
    });

    it('should return null when nothing was stashed', () => {
      expect(cm.consumePendingEditorContext()).toBeNull();
    });

    it('should return null and clear after the 10s expiry window', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      vi.advanceTimersByTime(10_000 + 1);
      expect(cm.consumePendingEditorContext()).toBeNull();
    });

    it('should still return the payload just before expiry', () => {
      const payload = { absolutePath: '/abs/a.ts', relativePath: 'a.ts' };
      cm.setPendingEditorContext(payload);
      vi.advanceTimersByTime(9_999);
      expect(cm.consumePendingEditorContext()).toEqual(payload);
    });

    it('should overwrite an earlier pending payload with the latest one', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/old.ts', relativePath: 'old.ts' });
      const latest = { absolutePath: '/abs/new.ts', relativePath: 'new.ts' };
      cm.setPendingEditorContext(latest);
      expect(cm.consumePendingEditorContext()).toEqual(latest);
    });

    it('should replay a stashed payload to a newly added connection as EDITOR_CONTEXT', () => {
      const payload = { absolutePath: '/abs/src/file.ts', relativePath: 'src/file.ts', startLine: 10, endLine: 25 };
      cm.setPendingEditorContext(payload);

      const ws = createMockWs();
      cm.addConnection(ws);

      expect(ws.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(sent.type).toBe(MessageType.EDITOR_CONTEXT);
      expect(sent.payload).toEqual(payload);
    });

    it('should consume the buffer on replay so the next connection gets nothing', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      cm.addConnection(createMockWs());

      const ws2 = createMockWs();
      cm.addConnection(ws2);
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('should not replay an expired buffer to a newly added connection', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      vi.advanceTimersByTime(10_000 + 1);

      const ws = createMockWs();
      cm.addConnection(ws);
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('running sessions tracking', () => {
    it('should return running sessions and broadcast running sessions list on process changes', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      const mockProc = {} as any;

      cm.setProcess('sess-1', mockProc);
      expect(cm.getRunningSessionIds()).toEqual(['sess-1']);

      expect(ws.send).toHaveBeenCalled();
      const lastCall = (ws.send as any).mock.calls[(ws.send as any).mock.calls.length - 1][0];
      const payload = JSON.parse(lastCall);
      expect(payload.type).toBe(MessageType.RUNNING_SESSIONS);
      expect(payload.payload.sessionIds).toEqual(['sess-1']);

      cm.setProcess('sess-1', null);
      expect(cm.getRunningSessionIds()).toEqual([]);
    });

    it('should mark a session running from JSONL activity and expire it after the window', () => {
      vi.useFakeTimers();
      try {
        const ws = createMockWs();
        cm.addConnection(ws);

        cm.markSessionActivity('sess-ext');
        expect(cm.getRunningSessionIds()).toEqual(['sess-ext']);

        // Broadcast fires on the idle→running transition.
        const lastCall = (ws.send as any).mock.calls.at(-1)[0];
        expect(JSON.parse(lastCall).payload.sessionIds).toEqual(['sess-ext']);

        // Still running within the activity window.
        vi.advanceTimersByTime(10_000);
        expect(cm.getRunningSessionIds()).toEqual(['sess-ext']);

        // Expires once the window elapses with no further appends.
        vi.advanceTimersByTime(15_000);
        expect(cm.getRunningSessionIds()).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should union process-owned and activity-based running sessions', () => {
      vi.useFakeTimers();
      try {
        cm.addConnection(createMockWs());
        cm.setProcess('sess-proc', {} as any);
        cm.markSessionActivity('sess-ext');
        expect(cm.getRunningSessionIds().sort()).toEqual(['sess-ext', 'sess-proc']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should NOT re-broadcast on repeated activity within the window (only on idle→running)', () => {
      vi.useFakeTimers();
      try {
        const ws = createMockWs();
        cm.addConnection(ws);
        (ws.send as any).mockClear();

        // First mark → idle→running transition → exactly one broadcast.
        cm.markSessionActivity('sess-ext');
        const broadcastsAfterFirst = (ws.send as any).mock.calls.length;
        expect(broadcastsAfterFirst).toBe(1);

        // Repeated appends within the window must NOT re-broadcast (no storm).
        vi.advanceTimersByTime(2_000);
        cm.markSessionActivity('sess-ext');
        vi.advanceTimersByTime(2_000);
        cm.markSessionActivity('sess-ext');
        expect((ws.send as any).mock.calls.length).toBe(broadcastsAfterFirst);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should broadcast exactly one running→idle update when activity expires', () => {
      vi.useFakeTimers();
      try {
        const ws = createMockWs();
        cm.addConnection(ws);

        cm.markSessionActivity('sess-ext');
        (ws.send as any).mockClear();

        // Sweep past the window: exactly one expiry broadcast with an empty set.
        vi.advanceTimersByTime(SESSION_ACTIVITY_WINDOW_MS + SESSION_ACTIVITY_SWEEP_MS);
        const expiryBroadcasts = (ws.send as any).mock.calls
          .map((c: any[]) => JSON.parse(c[0]))
          .filter((m: any) => m.type === MessageType.RUNNING_SESSIONS);
        expect(expiryBroadcasts).toHaveLength(1);
        expect(expiryBroadcasts[0].payload.sessionIds).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should drop external activity tracking once a session is promoted to an owned process', () => {
      vi.useFakeTimers();
      try {
        cm.addConnection(createMockWs());

        // External activity marks it running.
        cm.markSessionActivity('sess-x');
        expect(cm.getRunningSessionIds()).toEqual(['sess-x']);

        // Promote to an owned process — running follows the process now.
        cm.setProcess('sess-x', {} as any);
        expect(cm.getRunningSessionIds()).toEqual(['sess-x']);

        // When the owned process ends, the session goes idle immediately — no stale
        // activity timestamp keeps it running for the rest of the window.
        cm.setProcess('sess-x', null);
        expect(cm.getRunningSessionIds()).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
