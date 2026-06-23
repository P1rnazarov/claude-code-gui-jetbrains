import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';

export function getWorkingDirHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): void {
  // Single-process mode: no default workingDir.
  // Clients must provide workingDir via URL params or project selection.
  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    workingDir: null,
  });
}
