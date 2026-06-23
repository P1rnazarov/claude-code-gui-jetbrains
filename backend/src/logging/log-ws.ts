import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { MessageType } from '../shared';

export enum LogLevel {
  LOG = 'log',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

export interface LogEntry {
  level: LogLevel;
  source: string;
  sessionId: string | null;
  message: string;
  timestamp: number;
}

interface LogBatchMessage {
  type: 'LOG_BATCH';
  entries: LogEntry[];
}

export class LogWebSocketServer {
  private readonly wss: WebSocketServer;
  private readonly clients: Set<WebSocket> = new Set();
  private readonly onLogBatch: (entries: LogEntry[]) => void;

  constructor(onLogBatch: (entries: LogEntry[]) => void) {
    this.onLogBatch = onLogBatch;
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      ws.on('message', (data: Buffer) => {
        let parsed: LogBatchMessage;
        try {
          parsed = JSON.parse(data.toString()) as LogBatchMessage;
        } catch {
          return;
        }

        if (parsed.type === MessageType.LOG_BATCH) {
          this.onLogBatch(parsed.entries);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }

  broadcast(line: string): void {
    const payload = JSON.stringify({ type: 'LOG_LINE', line });
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  close(): void {
    for (const ws of this.clients) {
      ws.close();
    }
    this.clients.clear();
    this.wss.close();
  }
}
