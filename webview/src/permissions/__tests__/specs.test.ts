import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function installNotificationMock(permission: NotificationPermission) {
  const requestSpy = vi.fn().mockResolvedValue(permission);
  class MockNotification {
    static permission: NotificationPermission = permission;
    static requestPermission = requestSpy;
  }
  (globalThis as unknown as { Notification: unknown }).Notification = MockNotification;
  return requestSpy;
}

function uninstallNotificationMock() {
  delete (globalThis as unknown as { Notification?: unknown }).Notification;
}

beforeEach(() => {
  vi.resetModules();
  uninstallNotificationMock();
});

afterEach(() => {
  uninstallNotificationMock();
});

describe('PERMISSION_SPECS', () => {
  it('exposes a single "notifications" spec', async () => {
    const { PERMISSION_SPECS } = await import('../specs');
    expect(PERMISSION_SPECS).toHaveLength(1);
    expect(PERMISSION_SPECS[0].id).toBe('notifications');
    expect(PERMISSION_SPECS[0].label).toBe('Desktop Notifications');
    expect(typeof PERMISSION_SPECS[0].description).toBe('string');
  });

  describe('notifications spec', () => {
    it('available() returns false when window.Notification is undefined', async () => {
      uninstallNotificationMock();
      const { PERMISSION_SPECS } = await import('../specs');
      expect(PERMISSION_SPECS[0].available()).toBe(false);
    });

    it('available() returns true when window.Notification is defined', async () => {
      installNotificationMock('default');
      const { PERMISSION_SPECS } = await import('../specs');
      expect(PERMISSION_SPECS[0].available()).toBe(true);
    });

    it('getState() returns Notification.permission when available', async () => {
      installNotificationMock('granted');
      const { PERMISSION_SPECS } = await import('../specs');
      expect(PERMISSION_SPECS[0].getState()).toBe('granted');
    });

    it('getState() returns "default" as a safe fallback when Notification is absent', async () => {
      uninstallNotificationMock();
      const { PERMISSION_SPECS } = await import('../specs');
      expect(PERMISSION_SPECS[0].getState()).toBe('default');
    });

    it('request() calls Notification.requestPermission and resolves with the result', async () => {
      const requestSpy = installNotificationMock('granted');
      const { PERMISSION_SPECS } = await import('../specs');
      await expect(PERMISSION_SPECS[0].request()).resolves.toBe('granted');
      expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it('request() resolves to "denied" as a safe fallback when Notification is absent', async () => {
      uninstallNotificationMock();
      const { PERMISSION_SPECS } = await import('../specs');
      await expect(PERMISSION_SPECS[0].request()).resolves.toBe('denied');
    });
  });
});
