import { getAdapter } from '@/adapters';
import { StaticItem } from '../../types';
import { Route, routeToPath, withWorkingDir } from '@/router/routes';

/** Navigate to the account switch page. Shared by "Switch account" and /login. */
const openSwitchAccount = async () => {
  window.history.pushState({}, '', withWorkingDir(routeToPath(Route.SWITCH_ACCOUNT)));
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const settingsItems = [
  // Search-only alias: surfaces when the user types `/login`. Same destination
  // as "Switch account" — the account switch page. Listed before
  // "Switch account" so it appears first under the /login search.
  new StaticItem('login', '/login', {
    disabled: false,
    searchOnly: true,
    action: openSwitchAccount,
  }),
  new StaticItem('switch-account', 'Switch account', {
    disabled: false,
    // Also surfaces under the `/login` search, alongside the /login alias.
    keywords: ['login'],
    action: openSwitchAccount,
  }),
  new StaticItem('general-config', 'General config...', {
    disabled: false,
    action: async () => {
      await getAdapter().openSettings();
    },
  }),
];
