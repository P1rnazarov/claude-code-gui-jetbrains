import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';

export async function openTerminalHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  try {
    const workingDir = message.payload?.['workingDir'] as string | undefined;
    if (!workingDir) {
      connections.sendTo(connectionId, MessageType.ERROR, {
        requestId: message.requestId,
        error: 'workingDir is required',
      });
      return;
    }
    await bridge.openTerminal(workingDir);
  } catch (err) {
    console.error('[node-backend]', 'bridge.openTerminal() failed:', err);
  }
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
