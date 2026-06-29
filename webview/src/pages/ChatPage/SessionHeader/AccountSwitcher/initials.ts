/**
 * Compute up-to-2-letter initials for the account avatar.
 * Prefers the display name ("Alice Wonderland" → "AW", "Bek" → "BE"); falls back
 * to the first characters of the email. Returns null when nothing is known.
 */
export function initialsFor(displayName?: string | null, email?: string | null): string | null {
  const name = displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  const addr = email?.trim();
  if (addr) return addr.slice(0, 2).toUpperCase();
  return null;
}
