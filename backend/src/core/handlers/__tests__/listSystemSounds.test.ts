import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../system-sounds', () => ({
  scanSystemSounds: vi.fn(),
}));

import { scanSystemSounds } from '../../../system-sounds';
import { listSystemSoundsHandler } from '../listSystemSounds';
import type { ConnectionManager } from '../../../ws/connection-manager';
import type { Bridge } from '../../../bridge/bridge-interface';
import type { IPCMessage } from '../../types';
import { MessageType } from '../../../shared';

const mockScan = vi.mocked(scanSystemSounds);

function createMockConnections() {
  return {
    sendTo: vi.fn(),
    broadcastToAll: vi.fn(),
  } as unknown as ConnectionManager;
}

const mockBridge = {} as Bridge;

describe('listSystemSoundsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns id/label pairs and strips the absolute path', async () => {
    const connections = createMockConnections();
    mockScan.mockResolvedValue([
      { id: 'Glass', label: 'Glass', path: '/System/Library/Sounds/Glass.aiff' },
      { id: 'Ping', label: 'Ping', path: '/System/Library/Sounds/Ping.aiff' },
    ]);
    const message: IPCMessage = {
      type: MessageType.LIST_SYSTEM_SOUNDS,
      payload: {},
      timestamp: 0,
      requestId: 'req-1',
    };

    await listSystemSoundsHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', MessageType.ACK, {
      requestId: 'req-1',
      status: 'ok',
      sounds: [
        { id: 'Glass', label: 'Glass' },
        { id: 'Ping', label: 'Ping' },
      ],
    });
    // Confirm path is NOT leaked to the client.
    const payload = (connections.sendTo as ReturnType<typeof vi.fn>).mock.calls[0]![2];
    for (const s of payload.sounds) {
      expect(s).not.toHaveProperty('path');
    }
  });

  it('handles an empty scan result', async () => {
    const connections = createMockConnections();
    mockScan.mockResolvedValue([]);
    const message: IPCMessage = {
      type: MessageType.LIST_SYSTEM_SOUNDS,
      payload: {},
      timestamp: 0,
      requestId: 'req-1',
    };

    await listSystemSoundsHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', MessageType.ACK, {
      requestId: 'req-1',
      status: 'ok',
      sounds: [],
    });
  });

  it('returns error status when the scan throws', async () => {
    const connections = createMockConnections();
    mockScan.mockRejectedValue(new Error('disk on fire'));
    const message: IPCMessage = {
      type: MessageType.LIST_SYSTEM_SOUNDS,
      payload: {},
      timestamp: 0,
      requestId: 'req-1',
    };

    await listSystemSoundsHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', MessageType.ACK, {
      requestId: 'req-1',
      status: 'error',
      error: 'disk on fire',
    });
  });
});
