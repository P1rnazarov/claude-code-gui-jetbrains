import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock BEFORE imports
vi.mock('../../claude', () => ({
  Claude: {
    exec: vi.fn(),
    applyConfigDir: vi.fn(),
  },
}));

vi.mock('../../features/account-store', () => ({
  readRegistry: vi.fn(),
  readSnapshot: vi.fn(),
}));

vi.mock('../../features/account-usage', () => ({
  usageForSnapshot: vi.fn(),
}));

vi.mock('../getUsage', () => ({
  runCcbUsage: vi.fn(),
  classifyError: vi.fn().mockReturnValue({ kind: 'unknown', message: 'Test error' }),
}));

import { getAllUsageHandler } from '../getAllUsage';
import { Claude } from '../../claude';
import { readRegistry, readSnapshot } from '../../features/account-store';
import { usageForSnapshot } from '../../features/account-usage';
import { runCcbUsage } from '../getUsage';
import type { ConnectionManager } from '../../../ws/connection-manager';
import type { Bridge } from '../../../bridge/bridge-interface';
import type { IPCMessage } from '../../types';
import { MessageType } from '../../../shared';

const mockExec = vi.mocked(Claude.exec);
const mockReadRegistry = vi.mocked(readRegistry);
const mockReadSnapshot = vi.mocked(readSnapshot);
const mockUsageForSnapshot = vi.mocked(usageForSnapshot);
const mockRunCcbUsage = vi.mocked(runCcbUsage);

function createMockConnections() {
  return {
    sendTo: vi.fn(),
  } as unknown as ConnectionManager;
}

const mockBridge = {} as Bridge;

describe('getAllUsageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles active account via ccb and inactive via snapshot usage fetch', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: MessageType.GET_ALL_USAGE,
      payload: { force: true },
      timestamp: 0,
      requestId: 'req-all-usage',
    };

    // Active email from claude auth status
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ email: 'active@example.com' }),
      stderr: '',
    });

    // Registry contains active account + another inactive saved account
    mockReadRegistry.mockResolvedValue({
      current: 'acc-active',
      accounts: {
        'acc-active': {
          id: 'acc-active',
          emailAddress: 'active@example.com',
          displayName: 'Active User',
          organizationName: null,
          subscriptionType: null,
          authMethod: null,
          createdAt: 0,
          updatedAt: 0,
        },
        'acc-inactive': {
          id: 'acc-inactive',
          emailAddress: 'inactive@example.com',
          displayName: 'Inactive User',
          organizationName: null,
          subscriptionType: null,
          authMethod: null,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    });

    // Live usage response
    mockRunCcbUsage.mockResolvedValue({
      five_hour: { utilization: 0.2, resets_at: '2026-06-29T21:30:41Z' },
      seven_day: null,
      seven_day_oauth_apps: null,
      seven_day_sonnet: null,
      seven_day_opus: null,
      seven_day_cowork: null,
      iguana_necktie: null,
      extra_usage: null,
    });

    // Inactive snapshot + usageForSnapshot response
    mockReadSnapshot.mockResolvedValue({
      credentials: '{}',
      oauthAccount: null,
    });
    mockUsageForSnapshot.mockResolvedValue({
      usage: {
        five_hour: { utilization: 0.8, resets_at: '2026-06-29T21:30:41Z' },
        seven_day: null,
        seven_day_sonnet: null,
        seven_day_opus: null,
      },
      error: null,
      errorKind: null,
    });

    await getAllUsageHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith(
      'conn-1',
      MessageType.ACK,
      expect.objectContaining({
        requestId: 'req-all-usage',
        status: 'ok',
        accounts: [
          expect.objectContaining({
            id: 'acc-active',
            emailAddress: 'active@example.com',
            active: true,
            usage: expect.objectContaining({
              five_hour: expect.objectContaining({ utilization: 0.2 }),
            }),
          }),
          expect.objectContaining({
            id: 'acc-inactive',
            emailAddress: 'inactive@example.com',
            active: false,
            usage: expect.objectContaining({
              five_hour: expect.objectContaining({ utilization: 0.8 }),
            }),
          }),
        ],
      }),
    );
  });

  it('synthesizes entry if active account is not in the registry', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: MessageType.GET_ALL_USAGE,
      payload: { force: true },
      timestamp: 0,
      requestId: 'req-all-usage',
    };

    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ email: 'live-only@example.com' }),
      stderr: '',
    });

    mockReadRegistry.mockResolvedValue({
      current: null,
      accounts: {},
    });

    mockRunCcbUsage.mockResolvedValue({
      five_hour: { utilization: 0.5, resets_at: '2026-06-29T21:30:41Z' },
      seven_day: null,
      seven_day_oauth_apps: null,
      seven_day_sonnet: null,
      seven_day_opus: null,
      seven_day_cowork: null,
      iguana_necktie: null,
      extra_usage: null,
    });

    await getAllUsageHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith(
      'conn-1',
      MessageType.ACK,
      expect.objectContaining({
        requestId: 'req-all-usage',
        status: 'ok',
        accounts: [
          expect.objectContaining({
            id: 'live',
            emailAddress: 'live-only@example.com',
            active: true,
            usage: expect.objectContaining({
              five_hour: expect.objectContaining({ utilization: 0.5 }),
            }),
          }),
        ],
      }),
    );
  });

  it('returns error field if ccb fails for active account', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: MessageType.GET_ALL_USAGE,
      payload: { force: true },
      timestamp: 0,
      requestId: 'req-all-usage',
    };

    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ email: 'active@example.com' }),
      stderr: '',
    });

    mockReadRegistry.mockResolvedValue({
      current: 'acc-active',
      accounts: {
        'acc-active': {
          id: 'acc-active',
          emailAddress: 'active@example.com',
          displayName: 'Active User',
          organizationName: null,
          subscriptionType: null,
          authMethod: null,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    });

    mockRunCcbUsage.mockRejectedValue(new Error('ccb error'));

    await getAllUsageHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith(
      'conn-1',
      MessageType.ACK,
      expect.objectContaining({
        requestId: 'req-all-usage',
        status: 'ok',
        accounts: [
          expect.objectContaining({
            id: 'acc-active',
            emailAddress: 'active@example.com',
            active: true,
            error: 'Test error',
            errorKind: 'unknown',
          }),
        ],
      }),
    );
  });
});
