import { useCallback, useEffect, useState } from 'react';
import { SOUND_OFF, type SoundSelection } from './types';

export const NOTIFICATION_SOUND_STORAGE_KEY = 'claude-code-gui:notification-sound';

/**
 * Legacy stored value from Phase 1 that asked the browser to use the OS
 * default notification sound via `silent: false`. As of Phase 1.5 the app
 * plays OS sounds directly via the backend, and that legacy value no longer
 * maps to a real backend `soundId` — read-time it is converted to
 * `SOUND_OFF` so the user explicitly picks a sound from the new dynamic list.
 */
const LEGACY_OS_DEFAULT = 'os_default';

function normalizeStoredValue(raw: string | null): SoundSelection {
  if (raw === null || raw === '') return SOUND_OFF;
  if (raw === LEGACY_OS_DEFAULT) return SOUND_OFF;
  // Any other non-empty string is treated as a backend `soundId`. The
  // settings UI is responsible for filtering to currently valid ids.
  return raw;
}

function readStoredSelection(): SoundSelection {
  try {
    return normalizeStoredValue(localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY));
  } catch {
    return SOUND_OFF;
  }
}

function persistSelection(selection: SoundSelection): void {
  try {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, selection);
  } catch {
    // ignore (e.g. quota exceeded, privacy mode)
  }
}

interface UseNotificationSoundReturn {
  selection: SoundSelection;
  setSelection: (selection: SoundSelection) => void;
}

/**
 * React hook exposing the user's notification-sound preference.
 *
 * Default (no stored value) is `SOUND_OFF` — Phase 1.5 requires the user to
 * explicitly pick a sound from the dynamic OS list before any sound plays.
 *
 * Persists to localStorage and stays in sync with other tabs via `storage`.
 */
export function useNotificationSound(): UseNotificationSoundReturn {
  const [selection, setSelectionState] = useState<SoundSelection>(readStoredSelection);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== NOTIFICATION_SOUND_STORAGE_KEY) return;
      setSelectionState(normalizeStoredValue(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setSelection = useCallback((next: SoundSelection) => {
    persistSelection(next);
    setSelectionState(next);
  }, []);

  return { selection, setSelection };
}
