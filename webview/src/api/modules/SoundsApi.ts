import { BridgeClient } from '../bridge/BridgeClient';
import type { SystemSound } from '../../notifications/types';

interface ListSystemSoundsResponse {
  sounds?: SystemSound[];
}

/**
 * Sounds API module
 *
 * Bridges to the backend's OS system-sound integration:
 *  - `LIST_SYSTEM_SOUNDS` enumerates the sounds the host OS can play.
 *  - `PLAY_SYSTEM_SOUND { soundId }` fires a single playback (fire-and-forget;
 *    the backend ACKs at spawn time, not when playback finishes).
 */
export class SoundsApi {
  constructor(private bridge: BridgeClient) {}

  /**
   * Fetch the list of OS system sounds available for playback.
   *
   * Returns an empty array when the backend reports no sounds (e.g. an OS
   * without a known sound directory, or a directory that is present but empty).
   */
  async list(): Promise<SystemSound[]> {
    const response = await this.bridge.request<ListSystemSoundsResponse>(
      'LIST_SYSTEM_SOUNDS',
      {},
    );
    return response?.sounds ?? [];
  }

  /**
   * Ask the backend to play one OS system sound by id.
   *
   * The backend spawns the OS-native player (`afplay`, PowerShell, `paplay`)
   * and ACKs immediately, so callers should treat this as fire-and-forget.
   */
  async play(soundId: string): Promise<void> {
    await this.bridge.request('PLAY_SYSTEM_SOUND', { soundId });
  }
}
