import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';

export async function openUrlHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  try {
    const url = message.payload?.['url'] as string | undefined;
    if (url) {
      await bridge.openUrl(url);
    }
  } catch (err) {
    console.error('[node-backend]', 'bridge.openUrl() failed:', err);
  }
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
