/**
 * Per-permission "dismissed" flag persisted in localStorage.
 * Once a permission is dismissed it never re-shows in the banner; the user
 * can still grant it from Settings > Browser > Permissions.
 */
const DISMISS_KEY_PREFIX = 'claude-code-gui:permission-dismissed:';

export function buildDismissKey(id: string): string {
  return `${DISMISS_KEY_PREFIX}${id}`;
}

export function readDismissed(id: string): boolean {
  try {
    return localStorage.getItem(buildDismissKey(id)) === '1';
  } catch {
    return false;
  }
}

export function persistDismissed(id: string): void {
  try {
    localStorage.setItem(buildDismissKey(id), '1');
  } catch {
    // ignore (quota exceeded, privacy mode)
  }
}
