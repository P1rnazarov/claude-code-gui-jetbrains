import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserPermissionBanner } from '../BrowserPermissionBanner';
import { _resetRuntimeCache } from '@/config/environment';

// ---------------------------------------------------------------------------
// JCEF / browser env helpers
// ---------------------------------------------------------------------------

function setJcefEnv(jcef: boolean) {
  if (jcef) {
    (window as unknown as { __JCEF__?: boolean }).__JCEF__ = true;
  } else {
    delete (window as unknown as { __JCEF__?: boolean }).__JCEF__;
  }
  _resetRuntimeCache();
}

// ---------------------------------------------------------------------------
// Notification API mock
// ---------------------------------------------------------------------------

interface MockNotificationStatic {
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
}

function installNotificationMock(
  permission: NotificationPermission,
  requestResult: NotificationPermission = permission,
): MockNotificationStatic {
  const requestSpy = vi.fn().mockResolvedValue(requestResult);
  class MockNotification {
    static permission: NotificationPermission = permission;
    static requestPermission = requestSpy;
  }
  (globalThis as unknown as { Notification: unknown }).Notification = MockNotification;
  return MockNotification as unknown as MockNotificationStatic;
}

function uninstallNotificationMock() {
  delete (globalThis as unknown as { Notification?: unknown }).Notification;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const DISMISS_KEY = 'claude-code-gui:permission-dismissed:notifications';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  setJcefEnv(false); // default to browser environment
});

afterEach(() => {
  uninstallNotificationMock();
  setJcefEnv(false);
});

describe('BrowserPermissionBanner', () => {
  it('renders nothing in JCEF environment', () => {
    setJcefEnv(true);
    installNotificationMock('default');
    const { container } = render(<BrowserPermissionBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when Notification API is unavailable', () => {
    uninstallNotificationMock();
    const { container } = render(<BrowserPermissionBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when permission is already granted', () => {
    installNotificationMock('granted');
    const { container } = render(<BrowserPermissionBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when permission is denied (and was not requested in-session)', () => {
    installNotificationMock('denied');
    const { container } = render(<BrowserPermissionBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the user has dismissed it previously', () => {
    installNotificationMock('default');
    localStorage.setItem(DISMISS_KEY, '1');
    const { container } = render(<BrowserPermissionBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the banner with Allow and Dismiss when permission is default', () => {
    installNotificationMock('default');
    render(<BrowserPermissionBanner />);
    expect(screen.getByRole('button', { name: /allow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('Allow click invokes Notification.requestPermission', async () => {
    const mock = installNotificationMock('default', 'granted');
    render(<BrowserPermissionBanner />);
    fireEvent.click(screen.getByRole('button', { name: /allow/i }));
    await waitFor(() => {
      expect(mock.requestPermission).toHaveBeenCalledTimes(1);
    });
  });

  it('hides the banner after requestPermission resolves with granted', async () => {
    installNotificationMock('default', 'granted');
    const { container } = render(<BrowserPermissionBanner />);
    fireEvent.click(screen.getByRole('button', { name: /allow/i }));
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('shows "Enable from browser settings" guidance after requestPermission resolves with denied', async () => {
    installNotificationMock('default', 'denied');
    render(<BrowserPermissionBanner />);
    fireEvent.click(screen.getByRole('button', { name: /allow/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/enable from browser settings/i),
      ).toBeInTheDocument();
    });
    // Allow button must be gone; only Dismiss remains
    expect(
      screen.queryByRole('button', { name: /allow/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /dismiss/i }),
    ).toBeInTheDocument();
  });

  it('persists dismissal to localStorage when Dismiss is clicked', () => {
    installNotificationMock('default');
    render(<BrowserPermissionBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('hides itself after Dismiss is clicked', () => {
    installNotificationMock('default');
    const { container } = render(<BrowserPermissionBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(container.firstChild).toBeNull();
  });
});
