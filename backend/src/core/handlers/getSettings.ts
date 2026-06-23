import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { readMergedSettings, readSettingsFile, readProjectSettings } from '../features/settings';
import { getSettingsWatcher } from '../features/settings-watcher';
import { MessageType } from '../../shared';

export async function getSettingsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const workingDir = message.payload?.workingDir as string | undefined;
  const scope = message.payload?.scope as 'global' | 'project' | 'merged' | undefined;

  if (workingDir) {
    getSettingsWatcher()?.registerProject(workingDir);
  }

  let settings: Record<string, unknown>;
  let overrides: string[] = [];

  if (scope === 'global') {
    settings = await readSettingsFile();
  } else if (scope === 'project' && workingDir) {
    settings = await readProjectSettings(workingDir);
  } else {
    // Default: merged (for runtime use)
    const result = await readMergedSettings(workingDir);
    settings = result.settings;
    overrides = result.overrides;
  }

  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    settings,
    overrides,
  });
}
