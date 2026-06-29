import { watch, type FSWatcher } from 'fs';
import * as fsPromises from 'fs/promises';

interface WatchEntry {
  sessionId: string;
  filePath: string;
  watcher: FSWatcher | null;
  byteOffset: number;
  partialLine: string;
  subscribers: Map<string, (messages: any[]) => void>;
  reading: boolean;
  rereadPending: boolean;
  debounceTimer: NodeJS.Timeout | null;
}

export async function readNewBytes(
  filePath: string,
  startOffset: number,
): Promise<{ bytesRead: number; data: string }> {
  try {
    const stat = await fsPromises.stat(filePath);
    const size = stat.size;
    let actualStart = startOffset;
    if (size < startOffset) {
      actualStart = 0;
    }
    if (size <= actualStart) {
      return { bytesRead: 0, data: '' };
    }
    const fd = await fsPromises.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(size - actualStart);
      const { bytesRead } = await fd.read(buffer, 0, buffer.length, actualStart);
      return { bytesRead, data: buffer.toString('utf-8') };
    } finally {
      await fd.close();
    }
  } catch (err) {
    console.error('[SessionJsonlWatcher] Error reading new bytes:', err);
    return { bytesRead: 0, data: '' };
  }
}

export class SessionJsonlWatcher {
  private entries = new Map<string, WatchEntry>();
  private onAppend: (connectionId: string, sessionId: string, messages: any[]) => void;

  constructor(onAppend: (connectionId: string, sessionId: string, messages: any[]) => void) {
    this.onAppend = onAppend;
  }

  async watch(
    connectionId: string,
    sessionId: string,
    filePath: string,
  ): Promise<void> {
    let entry = this.entries.get(sessionId);
    if (!entry) {
      let initialOffset = 0;
      try {
        const stat = await fsPromises.stat(filePath).catch(() => null);
        if (stat) {
          initialOffset = stat.size;
        }
      } catch {
        // ignore
      }

      entry = {
        sessionId,
        filePath,
        watcher: null,
        byteOffset: initialOffset,
        partialLine: '',
        subscribers: new Map(),
        reading: false,
        rereadPending: false,
        debounceTimer: null,
      };

      this.entries.set(sessionId, entry);

      try {
        const watcher = watch(filePath, (_eventType) => {
          const ent = this.entries.get(sessionId);
          if (!ent) return;

          if (ent.debounceTimer) clearTimeout(ent.debounceTimer);
          ent.debounceTimer = setTimeout(() => {
            void this.tailRead(sessionId);
          }, 100);
        });
        entry.watcher = watcher;
      } catch (err) {
        console.error(`[SessionJsonlWatcher] Failed to watch file ${filePath}:`, err);
      }
    }

    entry.subscribers.set(connectionId, (messages) => {
      this.onAppend(connectionId, sessionId, messages);
    });
  }

  async tailRead(sessionId: string): Promise<void> {
    const entry = this.entries.get(sessionId);
    if (!entry) return;

    if (entry.reading) {
      entry.rereadPending = true;
      return;
    }

    entry.reading = true;
    try {
      const { bytesRead, data } = await readNewBytes(entry.filePath, entry.byteOffset);
      if (bytesRead > 0) {
        entry.byteOffset += bytesRead;
        const fullText = entry.partialLine + data;
        const lines = fullText.split('\n');
        entry.partialLine = lines.pop() ?? '';

        const messages: any[] = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            messages.push(JSON.parse(line));
          } catch (e) {
            // ignore malformed lines
          }
        }

        if (messages.length > 0) {
          for (const callback of entry.subscribers.values()) {
            try {
              callback(messages);
            } catch (e) {
              console.error('[SessionJsonlWatcher] callback error:', e);
            }
          }
        }
      }
    } catch (e) {
      console.error('[SessionJsonlWatcher] Error in tailRead:', e);
    } finally {
      entry.reading = false;
      if (entry.rereadPending) {
        entry.rereadPending = false;
        void this.tailRead(sessionId);
      }
    }
  }

  unwatch(connectionId: string, sessionId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) return;

    entry.subscribers.delete(connectionId);

    if (entry.subscribers.size === 0) {
      if (entry.watcher) {
        entry.watcher.close();
      }
      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer);
      }
      this.entries.delete(sessionId);
    }
  }

  unwatchConnection(connectionId: string): void {
    for (const [sessionId, entry] of this.entries.entries()) {
      if (entry.subscribers.has(connectionId)) {
        this.unwatch(connectionId, sessionId);
      }
    }
  }

  promoteToOwned(sessionId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) return;

    if (entry.watcher) {
      entry.watcher.close();
    }
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }
    this.entries.delete(sessionId);
  }

  stopAll(): void {
    for (const [, entry] of this.entries.entries()) {
      if (entry.watcher) {
        entry.watcher.close();
      }
      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer);
      }
    }
    this.entries.clear();
    console.log('[node-backend]', 'All session jsonl watchers stopped');
  }
}

let globalInstance: SessionJsonlWatcher | null = null;

export function getSessionJsonlWatcher(): SessionJsonlWatcher | null {
  return globalInstance;
}

export function initSessionJsonlWatcher(
  onAppend: (connectionId: string, sessionId: string, messages: any[]) => void,
): SessionJsonlWatcher {
  if (globalInstance) {
    globalInstance.stopAll();
  }
  globalInstance = new SessionJsonlWatcher(onAppend);
  return globalInstance;
}

export function stopSessionJsonlWatcher(): void {
  if (globalInstance) {
    globalInstance.stopAll();
    globalInstance = null;
  }
}
