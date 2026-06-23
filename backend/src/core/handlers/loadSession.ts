import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { loadSessionMessages } from '../features/loadSessionMessages';
import { markSessionAsSpawned } from '../claude-process';
import { MessageType } from '../../shared';

export async function loadSessionHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const workingDir = message.payload?.workingDir as string | undefined;
  const sessionId = message.payload?.sessionId as string;

  if (!workingDir) {
    connections.sendTo(connectionId, MessageType.ERROR, {
      requestId: message.requestId,
      error: 'workingDir is required',
    });
    return;
  }

  if (sessionId) {
    // 기존 세션 로딩 → 다음 spawn 시 --resume 사용하도록 마킹
    markSessionAsSpawned(sessionId);
    connections.subscribe(connectionId, sessionId);
    const messages = await loadSessionMessages(workingDir, sessionId);
    connections.sendTo(connectionId, MessageType.SESSION_LOADED, {
      sessionId,
      messages,
    });
  }
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
