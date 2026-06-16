import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionPanelPage } from '../index';

const { mockOpenNewTab, mockOpenSession, mockUseSessionList } = vi.hoisted(() => {
  const session = {
    id: 's1',
    title: 'My Session',
    createdAt: new Date('2026-06-15T10:00:00Z'),
    updatedAt: new Date('2026-06-15T11:00:00Z'),
    messageCount: 3,
    isSidechain: false,
  };
  return {
    mockOpenNewTab: vi.fn(),
    mockOpenSession: vi.fn().mockResolvedValue(undefined),
    mockUseSessionList: vi.fn(() => ({
      currentSessionId: null,
      searchQuery: '',
      setSearchQuery: vi.fn(),
      filteredSessions: [session],
      groupedSessions: {
        today: [session],
        yesterday: [],
        pastWeek: [],
        pastMonth: [],
        pastYear: [],
      },
      handleDeleteSession: vi.fn(),
      renameSession: vi.fn(),
      confirmDialog: null,
    })),
  };
});

vi.mock('@/contexts/SessionContext', () => ({
  useSessionContext: () => ({ openNewTab: mockOpenNewTab }),
}));

vi.mock('@/adapters', () => ({
  getAdapter: () => ({ openSession: mockOpenSession }),
}));

vi.mock('@/components/SessionList/useSessionList', () => ({
  useSessionList: mockUseSessionList,
}));

describe('SessionPanelPage', () => {
  beforeEach(() => {
    mockOpenNewTab.mockClear();
    mockOpenSession.mockClear();
    mockUseSessionList.mockClear();
  });

  it('renders the session title', () => {
    render(<SessionPanelPage />);
    expect(screen.getByText('My Session')).toBeDefined();
  });

  it('opens the clicked session in a new tab via the adapter', () => {
    render(<SessionPanelPage />);
    fireEvent.click(screen.getByRole('button', { name: /My Session/i }));
    expect(mockOpenSession).toHaveBeenCalledWith('s1');
  });

  it('opens a new session when "New session" is clicked', () => {
    render(<SessionPanelPage />);
    fireEvent.click(screen.getByRole('button', { name: /New session/i }));
    expect(mockOpenNewTab).toHaveBeenCalledTimes(1);
  });

  it('shows the web empty state when the Web tab is selected', () => {
    render(<SessionPanelPage />);
    expect(screen.queryByText('No web sessions')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Web' }));
    expect(screen.getByText('No web sessions')).toBeDefined();
    expect(screen.queryByText('My Session')).toBeNull();
  });
});
