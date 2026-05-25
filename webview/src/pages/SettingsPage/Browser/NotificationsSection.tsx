import { api } from '@/api/ClaudeCodeApi';
import {
  SOUND_OFF,
  useNotificationSound,
  useSystemSounds,
  type SoundSelection,
} from '@/notifications';
import { SettingSection, SettingRow } from '../common';

interface Props {
  className?: string;
}

/**
 * Settings UI for picking the desktop-notification sound.
 *
 * The list is fetched from the Node.js backend (`LIST_SYSTEM_SOUNDS`) and
 * is therefore OS-specific (macOS aiff, Windows wav, Linux freedesktop ogg).
 * Changing the selection plays a one-shot preview via `PLAY_SYSTEM_SOUND`.
 *
 * The first option is always `Off`. When the backend returns no sounds the
 * select is rendered with `Off` only plus an explanatory hint. While the
 * fetch is in flight the select is disabled.
 */
export const NotificationsSection = (props: Props) => {
  const { className = '' } = props;
  const { selection, setSelection } = useNotificationSound();
  const { sounds, loading, error } = useSystemSounds();

  const handleChange = (next: SoundSelection) => {
    setSelection(next);
    if (next !== SOUND_OFF) {
      // Fire-and-forget preview; failures are silently logged.
      api.sounds.play(next).catch((err: unknown) => {
        console.warn('[NotificationsSection] preview failed:', err);
      });
    }
  };

  const isEmpty = !loading && error === null && sounds.length === 0;
  const description =
    error !== null
      ? `Couldn't load system sounds: ${error}`
      : loading
        ? 'Loading system sounds...'
        : isEmpty
          ? 'No system sounds detected. Select Off to silence notifications.'
          : 'Sound played when a desktop notification fires. Selecting a sound previews it once.';

  return (
    <div className={className}>
      <SettingSection title="Notifications">
        <SettingRow label="Sound" description={description}>
          <select
            className="bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary disabled:opacity-50"
            value={selection}
            disabled={loading || error !== null}
            onChange={(e) => handleChange(e.target.value as SoundSelection)}
          >
            <option value={SOUND_OFF}>Off</option>
            {sounds.map((sound) => (
              <option key={sound.id} value={sound.id}>
                {sound.label}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingSection>
    </div>
  );
};
