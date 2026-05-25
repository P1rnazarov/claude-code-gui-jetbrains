import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// We want to swap out `api.sounds.list()` between tests, so capture a
// mutable function and have the api module proxy to it.
const listMock = vi.fn();

vi.mock('@/api/ClaudeCodeApi', () => ({
  api: {
    sounds: {
      list: (...args: unknown[]) => listMock(...args),
    },
  },
}));

import { useSystemSounds, _resetSystemSoundsCache } from '../useSystemSounds';

beforeEach(() => {
  _resetSystemSoundsCache();
  listMock.mockReset();
});

describe('useSystemSounds', () => {
  it('fetches sounds on first mount', async () => {
    listMock.mockResolvedValueOnce([
      { id: 'Glass', label: 'Glass' },
      { id: 'Ping', label: 'Ping' },
    ]);

    const { result } = renderHook(() => useSystemSounds());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(result.current.sounds).toEqual([
      { id: 'Glass', label: 'Glass' },
      { id: 'Ping', label: 'Ping' },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('starts in a loading state before the promise resolves', async () => {
    let resolveFn: ((value: { id: string; label: string }[]) => void) | undefined;
    listMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    const { result } = renderHook(() => useSystemSounds());

    expect(result.current.loading).toBe(true);
    expect(result.current.sounds).toEqual([]);
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveFn?.([{ id: 'a', label: 'A' }]);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.sounds).toEqual([{ id: 'a', label: 'A' }]);
  });

  it('serves cached sounds on subsequent calls without re-fetching', async () => {
    listMock.mockResolvedValueOnce([{ id: 'Glass', label: 'Glass' }]);

    const first = renderHook(() => useSystemSounds());
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });

    // Re-mount and confirm: no re-fetch, immediate data, immediate loading=false.
    const second = renderHook(() => useSystemSounds());

    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.sounds).toEqual([
      { id: 'Glass', label: 'Glass' },
    ]);
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request across concurrent mounts', async () => {
    let resolveFn: ((value: { id: string; label: string }[]) => void) | undefined;
    listMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    const a = renderHook(() => useSystemSounds());
    const b = renderHook(() => useSystemSounds());

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(a.result.current.loading).toBe(true);
    expect(b.result.current.loading).toBe(true);

    await act(async () => {
      resolveFn?.([{ id: 'X', label: 'X' }]);
    });

    await waitFor(() => {
      expect(a.result.current.loading).toBe(false);
    });
    await waitFor(() => {
      expect(b.result.current.loading).toBe(false);
    });

    expect(a.result.current.sounds).toEqual([{ id: 'X', label: 'X' }]);
    expect(b.result.current.sounds).toEqual([{ id: 'X', label: 'X' }]);
  });

  it('reports an error message when the fetch rejects', async () => {
    listMock.mockRejectedValueOnce(new Error('scan failed'));

    const { result } = renderHook(() => useSystemSounds());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sounds).toEqual([]);
    expect(result.current.error).toBe('scan failed');
  });

  it('re-fetches after the cache is reset', async () => {
    listMock.mockResolvedValueOnce([{ id: 'first', label: 'first' }]);

    const first = renderHook(() => useSystemSounds());
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });
    expect(listMock).toHaveBeenCalledTimes(1);

    _resetSystemSoundsCache();
    listMock.mockResolvedValueOnce([{ id: 'second', label: 'second' }]);

    const second = renderHook(() => useSystemSounds());
    await waitFor(() => {
      expect(second.result.current.loading).toBe(false);
    });

    expect(listMock).toHaveBeenCalledTimes(2);
    expect(second.result.current.sounds).toEqual([
      { id: 'second', label: 'second' },
    ]);
  });
});
