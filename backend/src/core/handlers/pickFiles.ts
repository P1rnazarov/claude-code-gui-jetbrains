import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';

export async function pickFilesHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  const mode = (message.payload?.mode as string) || 'files';
  const multiple = (message.payload?.multiple as boolean) ?? true;

  try {
    const result = await bridge.pickFiles({ mode: mode as 'files' | 'folders' | 'both', multiple });
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      paths: result.paths,
    });
  } catch (err) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
