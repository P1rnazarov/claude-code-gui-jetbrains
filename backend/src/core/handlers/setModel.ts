import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { sendSetModelToProcess } from '../claude-process';
import { MessageType } from '../../shared';

export function setModelHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): void {
  const client = connections.getClient(connectionId);
  const model = message.payload?.model as string;

  if (!client?.subscribedSessionId) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: 'No active session',
    });
    return;
  }

  const sessionId = client.subscribedSessionId;
  console.error('[node-backend]', `Setting model to "${model}" for session ${sessionId}`);
  const sent = sendSetModelToProcess(connections, sessionId, model);

  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: sent ? 'ok' : 'error',
    error: sent ? undefined : 'No writable process for session',
  });
}