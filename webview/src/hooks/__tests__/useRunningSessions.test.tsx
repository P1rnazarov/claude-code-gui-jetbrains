import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useRunningSessions } from '../useRunningSessions';
import { RunningSessionsProvider } from '@/contexts/RunningSessionsContext';
import { MessageType } from '@/shared';

const { mockSend, mockSubscribe } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockSubscribe: vi.fn()
}));

let connected = true;
let pushHandler: ((msg: any) => void) | null = null;

vi.mock('@/contexts/BridgeContext', () => ({
  useBridgeContext: () => ({
    isConnected: connected,
    send: mockSend,
    subscribe: mockSubscribe,
    lastError: null
  }),
}));

function Probe() {
  const { running } = useRunningSessions();
  return (
    <div>
      <span data-testid="running-count">{running.size}</span>
      <span data-testid="is-running-s1">{running.has('sess-1') ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('useRunningSessions and RunningSessionsProvider', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSubscribe.mockReset();
    connected = true;
    pushHandler = null;

    mockSubscribe.mockImplementation((type: string, handler: (msg: any) => void) => {
      if (type === MessageType.RUNNING_SESSIONS) {
        pushHandler = handler;
      }
      return () => undefined;
    });
  });

  it('initially requests running sessions and updates state', async () => {
    mockSend.mockResolvedValue({ sessionIds: ['sess-1'] });

    render(
      <RunningSessionsProvider>
        <Probe />
      </RunningSessionsProvider>
    );

    // Initial check
    expect(mockSend).toHaveBeenCalledWith(MessageType.GET_RUNNING_SESSIONS);
    await waitFor(() => {
      expect(screen.getByTestId('running-count').textContent).toBe('1');
    });
    expect(screen.getByTestId('is-running-s1').textContent).toBe('yes');
  });

  it('updates state when receiving a RUNNING_SESSIONS push event', async () => {
    mockSend.mockResolvedValue({ sessionIds: [] });

    render(
      <RunningSessionsProvider>
        <Probe />
      </RunningSessionsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('running-count').textContent).toBe('0');
    });

    // Simulate push event
    act(() => {
      if (pushHandler) {
        pushHandler({
          payload: { sessionIds: ['sess-1', 'sess-2'] }
        });
      }
    });

    expect(screen.getByTestId('running-count').textContent).toBe('2');
    expect(screen.getByTestId('is-running-s1').textContent).toBe('yes');
  });

  it('returns an empty set if used outside of provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('running-count').textContent).toBe('0');
    expect(screen.getByTestId('is-running-s1').textContent).toBe('no');
  });
});
