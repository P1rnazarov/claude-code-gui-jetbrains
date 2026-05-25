/**
 * Declarative permission specs.
 *
 * Each spec describes a browser permission the app may want to request from
 * the user. Callers must always check `available()` first, but the spec's
 * own `getState()` / `request()` implementations are defensive and degrade
 * gracefully when the underlying API is missing (e.g. JCEF).
 */
export interface PermissionSpec {
  id: string;
  label: string;
  description: string;
  available: () => boolean;
  getState: () => NotificationPermission;
  request: () => Promise<NotificationPermission>;
}

export const PERMISSION_SPECS: PermissionSpec[] = [
  {
    id: 'notifications',
    label: 'Desktop Notifications',
    description: 'Get notified when responses complete',
    available: () => typeof window !== 'undefined' && 'Notification' in window,
    getState: () => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'default';
      }
      return Notification.permission;
    },
    request: async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'denied';
      }
      return Notification.requestPermission();
    },
  },
  // Future entries: clipboard-read, persistent-storage, ...
];
