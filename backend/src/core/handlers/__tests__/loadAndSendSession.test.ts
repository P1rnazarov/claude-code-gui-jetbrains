import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../features/loadSessionMessages', () => ({
  loadSessionMessages: vi.fn(),
}));
vi.mock('../../features/workflow-tracker', () => ({
  reconstructWorkflowTasks: vi.fn(),
}));
vi.mock('../../claude-process', () => ({
  isWorkflowRunning: vi.fn(() => false),
}));

import { loadAndSendSession } from '../loadAndSendSession';
import { loadSessionMessages } from '../../features/loadSessionMessages';
import { reconstructWorkflowTasks } from '../../features/workflow-tracker';
import type { ConnectionManager } from '../../../ws/connection-manager';
import { MessageType } from '../../../shared';

const mockLoad = vi.mocked(loadSessionMessages);
const mockReconstruct = vi.mocked(reconstructWorkflowTasks);

interface SentMessage {
  type: string;
  payload: Record<string, unknown>;
}

function makeConnections(): { conn: ConnectionManager; sent: SentMessage[] } {
  const sent: SentMessage[] = [];
  const conn = {
    sendTo: (_id: string, type: string, payload: Record<string, unknown>) => {
      sent.push({ type, payload });
    },
  } as unknown as ConnectionManager;
  return { conn, sent };
}

describe('loadAndSendSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue({
      messages: [{ type: 'user', uuid: 'u1' }],
      hasMore: true,
      oldestUuid: 'u1',
      total: 100,
    });
    mockReconstruct.mockResolvedValue([]);
  });

  it('forwards the pagination limit to loadSessionMessages (reclaim regression)', async () => {
    const { conn } = makeConnections();
    await loadAndSendSession('conn-1', conn, '/work', 'sess-1', {
      limit: 1_000_000,
    });
    // signature: (workingDir, sessionId, beforeUuid, limit)
    expect(mockLoad).toHaveBeenCalledWith('/work', 'sess-1', undefined, 1_000_000);
  });

  it('sends SESSION_LOADED with the paging fields and prepend=false on initial load', async () => {
    const { conn, sent } = makeConnections();
    await loadAndSendSession('conn-1', conn, '/work', 'sess-1', {});

    const loaded = sent.find((m) => m.type === MessageType.SESSION_LOADED);
    expect(loaded?.payload).toMatchObject({
      sessionId: 'sess-1',
      hasMore: true,
      oldestUuid: 'u1',
      prepend: false,
    });
  });

  it('reconstructs workflows on initial load', async () => {
    const { conn } = makeConnections();
    await loadAndSendSession('conn-1', conn, '/work', 'sess-1', {});
    expect(mockReconstruct).toHaveBeenCalledOnce();
  });

  it('marks prepend=true and skips workflow reconstruction for an older page', async () => {
    const { conn, sent } = makeConnections();
    await loadAndSendSession('conn-1', conn, '/work', 'sess-1', {
      beforeUuid: 'u9',
      limit: 50,
      isOlderPage: true,
    });

    const loaded = sent.find((m) => m.type === MessageType.SESSION_LOADED);
    expect(loaded?.payload).toMatchObject({ prepend: true });
    expect(mockLoad).toHaveBeenCalledWith('/work', 'sess-1', 'u9', 50);
    expect(mockReconstruct).not.toHaveBeenCalled();
  });
});
