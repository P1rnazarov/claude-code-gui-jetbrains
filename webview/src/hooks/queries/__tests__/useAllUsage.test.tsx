import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MessageType } from '@/shared';
import { createTestQueryClient, makeQueryWrapper } from './testQueryClient';

const { mockSend, mockSubscribe } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockSubscribe: vi.fn(),
}));

let connected = true;
let changedHandler: (() => void) | null = null;

vi.mock('@/contexts/BridgeContext', () => ({
  useBridgeContext: () => ({
    isConnected: connected,
    send: mockSend,
    subscribe: mockSubscribe,
    lastError: null,
  }),
}));

vi.mock('@/contexts/WorkingDirContext', () => ({
  useWorkingDir: () => ({
    workingDirectory: '/test-dir',
  }),
}));

import { useAllUsage, type UseAllUsageResult } from '../useAllUsage';

const sampleResult = {
  status: 'ok',
  accounts: [
    {
      id: 'acc-1',
      emailAddress: 'user1@example.com',
      displayName: 'User 1',
      active: true,
      usage: {
        five_hour: { utilization: 0.2, resets_at: '2026-06-29T21:30:41Z' },
        seven_day: null,
        seven_day_sonnet: null,
        seven_day_opus: null,
      },
      error: null,
      errorKind: null,
    },
    {
      id: 'acc-2',
      emailAddress: 'user2@example.com',
      displayName: 'User 2',
      active: false,
      usage: null,
      error: 'credentials are unavailable',
      errorKind: 'auth',
    },
  ],
};

let current: UseAllUsageResult | null = null;
function Probe() {
  current = useAllUsage();
  return null;
}

function renderHook() {
  const client = createTestQueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  render(<Probe />, { wrapper: makeQueryWrapper(client) });
  return { client, invalidateSpy };
}

describe('useAllUsage', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSubscribe.mockReset();
    connected = true;
    current = null;
    changedHandler = null;
    mockSubscribe.mockImplementation((type: string, handler: () => void) => {
      if (type === MessageType.ACCOUNTS_CHANGED) changedHandler = handler;
      return () => undefined;
    });
  });

  it('loads the accounts usage from GET_ALL_USAGE', async () => {
    mockSend.mockResolvedValue(sampleResult);
    renderHook();
    await waitFor(() => expect(current?.accounts.length).toBe(2));
    expect(current?.accounts[0].emailAddress).toBe('user1@example.com');
    expect(current?.accounts[1].emailAddress).toBe('user2@example.com');
    expect(mockSend).toHaveBeenCalledWith(MessageType.GET_ALL_USAGE, {
      force: false,
      workingDir: '/test-dir',
    });
  });

  it('refetches on ACCOUNTS_CHANGED push', async () => {
    mockSend.mockResolvedValue(sampleResult);
    const { invalidateSpy } = renderHook();
    await waitFor(() => expect(changedHandler).not.toBeNull());

    act(() => {
      changedHandler!();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [MessageType.GET_ALL_USAGE, '/test-dir'],
    });
  });

  it('force refresh sends force:true and updates query data', async () => {
    mockSend.mockResolvedValue(sampleResult);
    renderHook();
    await waitFor(() => expect(current).not.toBeNull());

    const updatedSample = {
      ...sampleResult,
      accounts: [
        {
          ...sampleResult.accounts[0],
          usage: {
            ...sampleResult.accounts[0].usage,
            five_hour: { utilization: 0.4, resets_at: '2026-06-29T21:30:41Z' },
          },
        },
        sampleResult.accounts[1],
      ],
    };

    mockSend.mockResolvedValueOnce(updatedSample);

    await act(async () => {
      await current!.refresh();
    });

    expect(mockSend).toHaveBeenLastCalledWith(MessageType.GET_ALL_USAGE, {
      force: true,
      workingDir: '/test-dir',
    });

    expect(current?.accounts[0].usage?.five_hour?.utilization).toBe(0.4);
  });
});
