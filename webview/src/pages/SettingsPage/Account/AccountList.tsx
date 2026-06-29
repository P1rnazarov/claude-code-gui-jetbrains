import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useRouter } from '@/router/useRouter';
import { Route } from '@/router/routes';
import { useAccounts } from '@/hooks/queries/useAccounts';
import type { AccountListItem } from '@/shared';
import { AccountRow } from './AccountRow';

/**
 * Saved-accounts list for the multi-account switcher. Lists captured Claude
 * accounts with Switch / Remove, plus "Add account" (runs the in-app login, which
 * auto-captures on success) and "Save current account" (capture whoever is live).
 */
export function AccountList() {
  const { navigate } = useRouter();
  const { accounts, isLoading, error, save, switchTo, remove } = useAccounts();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (account: AccountListItem) => {
    void run(() => remove(account.id));
  };

  const shownError = actionError ?? error;

  return (
    <div className="py-1">
      {shownError && (
        <p className="text-[0.8461rem] text-state-error-fg mb-3 px-3 py-2 bg-state-error-bg border border-state-error-border rounded-lg">
          {shownError}
        </p>
      )}

      {accounts.length === 0 ? (
        <p className="text-[0.8461rem] text-text-tertiary py-2">
          {isLoading ? 'Loading accounts…' : 'No saved accounts yet. Add one to switch between logins.'}
        </p>
      ) : (
        <div>
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              busy={busy}
              onSwitch={(id) => void run(() => switchTo(id))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => navigate(Route.SWITCH_ACCOUNT)}
          disabled={busy}
          className="flex items-center gap-1.5 text-[0.8461rem] text-text-primary bg-accent-claude hover:bg-accent-claude-hover rounded px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add account
        </button>
        <button
          onClick={() => void run(save)}
          disabled={busy}
          className="text-[0.8461rem] text-text-secondary bg-surface-overlay border border-border-default rounded px-3 py-1.5 hover:bg-surface-tooltip disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save current account
        </button>
      </div>
    </div>
  );
}
