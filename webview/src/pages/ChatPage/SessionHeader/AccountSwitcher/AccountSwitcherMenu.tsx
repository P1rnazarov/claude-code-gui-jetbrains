import { useState } from 'react';
import { CheckIcon, PlusIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useRouter } from '@/router/useRouter';
import { Route } from '@/router/routes';
import { useAccounts } from '@/hooks/queries/useAccounts';

interface Props {
  onClose: () => void;
}

/**
 * Quick account-switch dropdown. Clicking a (non-active) row switches to that
 * account immediately. The active row shows a check and is not clickable. Footer
 * links jump to the in-app login ("Add account") or Settings → Account.
 *
 * Shares the GET_ACCOUNTS cache with the avatar button via useAccounts (same
 * query key), so this opens with the already-loaded list.
 */
export function AccountSwitcherMenu(props: Props) {
  const { onClose } = props;
  const { navigate } = useRouter();
  const { accounts, switchTo } = useAccounts();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSwitch = async (id: string) => {
    if (switchingId) return;
    setSwitchingId(id);
    setError(null);
    try {
      await switchTo(id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Switch failed');
      setSwitchingId(null);
    }
  };

  const go = (route: Route) => {
    onClose();
    navigate(route);
  };

  return (
    <div className="absolute right-0 top-full mt-1 w-[20rem] bg-surface-raised border border-border-default rounded-md shadow-xl overflow-hidden z-50">
      {error && (
        <p className="text-[0.7692rem] text-state-error-fg px-3 py-2 border-b border-border-default">{error}</p>
      )}

      <div className="max-h-[18rem] overflow-y-auto py-1">
        {accounts.length === 0 ? (
          <p className="text-[0.8461rem] text-text-tertiary px-3 py-2">No saved accounts.</p>
        ) : (
          accounts.map((account) => {
            const busy = switchingId === account.id;
            return (
              <button
                key={account.id}
                disabled={account.active || switchingId !== null}
                onClick={() => void handleSwitch(account.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-hover disabled:cursor-default disabled:hover:bg-transparent transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[0.8461rem] text-text-primary truncate">
                    {account.displayName ?? account.emailAddress}
                  </div>
                  {account.displayName && (
                    <div className="text-[0.7692rem] text-text-tertiary truncate">{account.emailAddress}</div>
                  )}
                </div>
                <span className="shrink-0 flex items-center">
                  {account.active ? (
                    <CheckIcon className="w-4 h-4 text-state-success-fg" />
                  ) : busy ? (
                    <span className="w-4 h-4 border-2 border-border-strong border-t-text-primary rounded-full animate-spin block" />
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-border-default py-1">
        <button
          onClick={() => go(Route.SWITCH_ACCOUNT)}
          className="w-full flex items-center gap-2 px-3 py-2 text-[0.8461rem] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add account
        </button>
        <button
          onClick={() => go(Route.SETTINGS_ACCOUNT)}
          className="w-full flex items-center gap-2 px-3 py-2 text-[0.8461rem] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <Cog6ToothIcon className="w-4 h-4" />
          Manage accounts
        </button>
      </div>
    </div>
  );
}
