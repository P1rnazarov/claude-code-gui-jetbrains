import { MessageType } from '@/shared';

enum LogLevel {
  LOG = 'log',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

interface LogEntry {
  level: LogLevel;
  source: string;
  sessionId: string | null;
  message: string;
  timestamp: number;
}

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;
const MAX_QUEUE_SIZE = 500;
const FLUSH_INTERVAL_MS = 500;
const RECONNECT_DELAY_MS = 2000;

class LogForwarder {
  private ws: WebSocket | null = null;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed: boolean = false;
  private originalConsole: Record<string, (...args: unknown[]) => void> = {};
  private sessionId: string | null = null;

  start(): void {
    this.interceptConsole();
    this.connect();
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  dispose(): void {
    this.disposed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  private connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/logs`;

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      this.ws = ws;
      this.flush();
    };
    ws.onclose = () => {
      this.ws = null;
      if (!this.disposed) {
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      }
    };
    ws.onerror = () => {
      // onclose가 자동으로 호출됨
    };
  }

  private interceptConsole(): void {
    for (const method of CONSOLE_METHODS) {
      const original = console[method].bind(console);
      this.originalConsole[method] = original;

      console[method] = (...args: unknown[]) => {
        original(...args);

        const message = args
          .map((a) => {
            if (typeof a === 'string') return a;
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(' ');
        this.buffer.push({
          level: method as unknown as LogLevel,
          source: 'webview',
          sessionId: this.sessionId,
          message,
          timestamp: Date.now(),
        });

        if (this.buffer.length > MAX_QUEUE_SIZE) {
          this.buffer = this.buffer.slice(-MAX_QUEUE_SIZE);
        }
      };
    }
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const entries = this.buffer.splice(0);
    this.ws.send(JSON.stringify({ type: MessageType.LOG_BATCH, entries }));
  }
}

let logForwarder: LogForwarder;

export function initLogForwarder(): LogForwarder {
  logForwarder = new LogForwarder();
  logForwarder.start();
  return logForwarder;
}

export function getLogForwarder(): LogForwarder {
  return logForwarder;
}
