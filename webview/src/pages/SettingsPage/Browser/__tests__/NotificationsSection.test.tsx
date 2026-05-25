import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// api.sounds mocking
// ---------------------------------------------------------------------------

const listMock = vi.fn();
const playMock = vi.fn();

vi.mock('@/api/ClaudeCodeApi', () => ({
  api: {
    sounds: {
      list: (...args: unknown[]) => listMock(...args),
      play: (...args: unknown[]) => playMock(...args),
    },
  },
}));

import { NotificationsSection } from '../NotificationsSection';
import {
  SOUND_OFF,
  NOTIFICATION_SOUND_STORAGE_KEY,
} from '@/notifications';
import { _resetSystemSoundsCache } from '@/notifications/useSystemSounds';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  _resetSystemSoundsCache();
  listMock.mockReset();
  playMock.mockReset();
  playMock.mockResolvedValue(undefined);
});

describe('NotificationsSection', () => {
  it('shows a loading hint and disables the select while sounds are fetching', () => {
    listMock.mockReturnValueOnce(new Promise(() => {}));
    render(<NotificationsSection />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText(/loading system sounds/i)).toBeInTheDocument();
  });

  it('renders Off plus the backend-provided sounds after fetch resolves', async () => {
    listMock.mockResolvedValueOnce([
      { id: 'Glass', label: 'Glass' },
      { id: 'Ping', label: 'Ping' },
    ]);

    render(<NotificationsSection />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });

    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual([SOUND_OFF, 'Glass', 'Ping']);
    expect(select.value).toBe(SOUND_OFF);
  });

  it('reads the persisted selection at mount', async () => {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, 'Ping');
    listMock.mockResolvedValueOnce([
      { id: 'Glass', label: 'Glass' },
      { id: 'Ping', label: 'Ping' },
    ]);

    render(<NotificationsSection />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });
    expect(select.value).toBe('Ping');
  });

  it('persists the new value to localStorage and previews it on change', async () => {
    listMock.mockResolvedValueOnce([
      { id: 'Glass', label: 'Glass' },
      { id: 'Ping', label: 'Ping' },
    ]);

    render(<NotificationsSection />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });

    fireEvent.change(select, { target: { value: 'Glass' } });

    expect(select.value).toBe('Glass');
    expect(localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY)).toBe('Glass');
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(playMock).toHaveBeenCalledWith('Glass');
  });

  it('does NOT preview when the user selects Off', async () => {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, 'Glass');
    listMock.mockResolvedValueOnce([{ id: 'Glass', label: 'Glass' }]);

    render(<NotificationsSection />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });
    expect(select.value).toBe('Glass');

    fireEvent.change(select, { target: { value: SOUND_OFF } });

    expect(select.value).toBe(SOUND_OFF);
    expect(localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY)).toBe(SOUND_OFF);
    expect(playMock).not.toHaveBeenCalled();
  });

  it('shows an empty-state hint when the backend returns no sounds', async () => {
    listMock.mockResolvedValueOnce([]);

    render(<NotificationsSection />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });

    // Only Off is selectable.
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual([SOUND_OFF]);
    expect(screen.getByText(/no system sounds detected/i)).toBeInTheDocument();
  });

  it('shows an error hint and disables the select when the fetch fails', async () => {
    listMock.mockRejectedValueOnce(new Error('scan failed'));

    render(<NotificationsSection />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;

    await waitFor(() => {
      expect(screen.getByText(/scan failed/i)).toBeInTheDocument();
    });
    expect(select.disabled).toBe(true);
  });

  it('swallows preview failures without throwing', async () => {
    listMock.mockResolvedValueOnce([{ id: 'Glass', label: 'Glass' }]);
    playMock.mockRejectedValueOnce(new Error('player crashed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<NotificationsSection />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });

    expect(() =>
      fireEvent.change(select, { target: { value: 'Glass' } }),
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
