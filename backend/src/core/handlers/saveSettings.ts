import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { saveSettingToScope, readMergedSettings } from '../features/settings';
import { Claude } from '../claude';
import { MessageType } from '../../shared';

export async function saveSettingsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const key = message.payload?.key as string;
  const value = message.payload?.value;
  const scope = (message.payload?.scope as 'global' | 'project') || 'global';
  const workingDir = message.payload?.workingDir as string | undefined;

  const result = await saveSettingToScope(key, value, scope, workingDir);

  if (result.status === 'ok' && key === 'cliPath') {
    await Claude.refresh();
  }

  // Broadcast merged settings after save
  if (result.status === 'ok') {
    const { settings, overrides } = await readMergedSettings(workingDir);
    connections.broadcastToAll(MessageType.SETTINGS_CHANGED, { settings, overrides });
  }

  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    ...result,
  });
}
