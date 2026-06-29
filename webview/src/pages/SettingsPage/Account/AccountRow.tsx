import { TrashIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import type { AccountListItem } from '@/shared';

interface AccountRowProps {
  account: AccountListItem;
  /** True while any account action is in flight (disables this row's buttons). */
  busy: boolean;
  onSwitch: (id: string) => void;
  onDelete: (account: AccountListItem) => void;
}

// snake_case → Title Case, matching the Profile section's plan formatting.
function formatPlan(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function AccountRow(props: AccountRowProps) {
  const { account, busy, onSwitch, onDelete } = props;
  const plan = formatPlan(account.subscriptionType);
  const title = account.displayName ?? account.emailAddress;
  const subtitle = account.displayName ? account.emailAddress : account.organizationName;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border-default last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.9230rem] text-text-primary truncate">{title}</span>
          {plan && (
            <span className="text-[0.7692rem] text-text-tertiary border border-border-default rounded px-1.5 py-0.5 shrink-0">
              {plan}
            </span>
          )}
        </div>
        {subtitle && <div className="text-[0.8461rem] text-text-tertiary truncate">{subtitle}</div>}
      </div>

      <div className="flex items-center gap-2 shrink-0 pl-3">
        {account.active ? (
          <span className="flex items-center gap-1 text-[0.8461rem] text-state-success-fg">
            <CheckBadgeIcon className="w-4 h-4" />
            In use
          </span>
        ) : (
          <button
            onClick={() => onSwitch(account.id)}
            disabled={busy}
            className="text-[0.8461rem] text-text-primary bg-surface-overlay border border-border-default rounded px-2.5 py-1 hover:bg-surface-tooltip disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Switch
          </button>
        )}
        <button
          onClick={() => onDelete(account)}
          disabled={busy}
          title="Remove account"
          className="p-1 rounded text-text-tertiary hover:text-state-error-fg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
