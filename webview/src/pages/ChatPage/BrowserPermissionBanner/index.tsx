import { useMemo } from 'react';
import { PERMISSION_SPECS } from '@/permissions';
import { isBrowser } from '@/config/environment';
import { readDismissed } from './dismissed';
import { PermissionBannerRow } from './PermissionBannerRow';

export const BrowserPermissionBanner = () => {
  const browser = isBrowser();

  const visibleSpecs = useMemo(
    () =>
      browser
        ? PERMISSION_SPECS.filter((s) => s.available() && !readDismissed(s.id))
        : [],
    [browser],
  );

  if (!browser) return null;
  if (visibleSpecs.length === 0) return null;

  return (
    <>
      {visibleSpecs.map((spec) => (
        <PermissionBannerRow key={spec.id} spec={spec} />
      ))}
    </>
  );
};
