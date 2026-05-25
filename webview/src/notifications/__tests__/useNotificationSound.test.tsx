import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useNotificationSound,
  NOTIFICATION_SOUND_STORAGE_KEY,
} from '../useNotificationSound';
import { SOUND_OFF } from '../types';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

describe('useNotificationSound', () => {
  it('defaults to SOUND_OFF when nothing is stored', () => {
    const { result } = renderHook(() => useNotificationSound());
    expect(result.current.selection).toBe(SOUND_OFF);
  });

  it('reads a stored backend soundId at mount', () => {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, 'Glass');
    const { result } = renderHook(() => useNotificationSound());
    expect(result.current.selection).toBe('Glass');
  });

  it('reads a stored SOUND_OFF at mount', () => {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, SOUND_OFF);
    const { result } = renderHook(() => useNotificationSound());
    expect(result.current.selection).toBe(SOUND_OFF);
  });

  it('migrates the legacy "os_default" stored value to SOUND_OFF at read time', () => {
    // Do not overwrite localStorage — Phase 1.5 only normalizes on read.
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, 'os_default');
    const { result } = renderHook(() => useNotificationSound());
    expect(result.current.selection).toBe(SOUND_OFF);
    // The raw value is left untouched until the user explicitly chooses again.
    expect(localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY)).toBe('os_default');
  });

  it('setSelection persists a backend soundId and updates state', () => {
    const { result } = renderHook(() => useNotificationSound());
    act(() => {
      result.current.setSelection('Ping');
    });
    expect(result.current.selection).toBe('Ping');
    expect(localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY)).toBe('Ping');
  });

  it('setSelection persists SOUND_OFF and updates state', () => {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, 'Glass');
    const { result } = renderHook(() => useNotificationSound());
    expect(result.current.selection).toBe('Glass');

    act(() => {
      result.current.setSelection(SOUND_OFF);
    });
    expect(result.current.selection).toBe(SOUND_OFF);
    expect(localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY)).toBe(SOUND_OFF);
  });

  it('syncs from cross-tab storage events to a new soundId', () => {
    const { result } = renderHook(() => useNotificationSound());
    expect(result.current.selection).toBe(SOUND_OFF);

    act(() => {
      localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, 'Hero');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: NOTIFICATION_SOUND_STORAGE_KEY,
          newValue: 'Hero',
        }),
      );
    });

    expect(result.current.selection).toBe('Hero');
  });

  it('syncs cross-tab storage clears (newValue === null) to SOUND_OFF', () => {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, 'Glass');
    const { result } = renderHook(() => useNotificationSound());
    expect(result.current.selection).toBe('Glass');

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: NOTIFICATION_SOUND_STORAGE_KEY,
          newValue: null,
        }),
      );
    });

    expect(result.current.selection).toBe(SOUND_OFF);
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => useNotificationSound());
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'unrelated-key',
          newValue: 'Glass',
        }),
      );
    });
    expect(result.current.selection).toBe(SOUND_OFF);
  });
});
