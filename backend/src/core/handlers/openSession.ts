import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

export async function openSessionHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  try {
    const sessionId = message.payload?.sessionId as string | undefined;
    const workingDir = message.payload?.workingDir as string | undefined;
    if (sessionId) {
      await bridge.openSession(sessionId, workingDir);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[node-backend]', `bridge.openSession() failed: ${msg}`);
  }

  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
}
