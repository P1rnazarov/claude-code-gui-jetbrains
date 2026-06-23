import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getSessionsList } from '../features/getSessionsList';
import { MessageType } from '../../shared';

export async function getSessionsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const workingDir = message.payload?.workingDir as string | undefined;

  if (!workingDir) {
    connections.sendTo(connectionId, MessageType.ERROR, {
      requestId: message.requestId,
      error: 'workingDir is required',
    });
    return;
  }

  console.error('[getSessions]', 'resolved workingDir:', workingDir);

  const sessions = await getSessionsList(workingDir);

  console.error('[getSessions]', 'returning sessions:', sessions.length);

  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId, sessions });
}
