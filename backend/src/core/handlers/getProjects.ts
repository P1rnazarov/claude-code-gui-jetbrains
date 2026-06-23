import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getProjectsList } from '../features/getProjectsList';
import { MessageType } from '../../shared';

export async function getProjectsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const projects = await getProjectsList();
  connections.sendTo(connectionId, MessageType.PROJECTS_LIST, { projects });
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
