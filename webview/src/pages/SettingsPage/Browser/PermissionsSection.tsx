import { useMemo, useState } from 'react';
import { SettingSection, SettingRow } from '../common';
import { PERMISSION_SPECS, type PermissionSpec } from '@/permissions';

interface Props {
  className?: string;
}

export const PermissionsSection = (props: Props) => {
  const { className = '' } = props;
  const availableSpecs = useMemo(
    () => PERMISSION_SPECS.filter((s) => s.available()),
    [],
  );

  if (availableSpecs.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <SettingSection title="Permissions">
        {availableSpecs.map((spec) => (
          <PermissionRow key={spec.id} spec={spec} />
        ))}
      </SettingSection>
    </div>
  );
};

interface PermissionRowProps {
  spec: PermissionSpec;
}

function PermissionRow(props: PermissionRowProps) {
  const { spec } = props;
  const [state, setState] = useState<NotificationPermission>(spec.getState());

  const handleRequest = () => {
    spec
      .request()
      .then((next) => setState(next))
      .catch(() => setState(spec.getState()));
  };

  return (
    <SettingRow
      label={spec.label}
      description={
        state === 'granted'
          ? 'To revoke, change in your browser settings.'
          : state === 'denied'
            ? 'Enable from browser settings'
            : spec.description
      }
    >
      {state === 'granted' && (
        <span className="text-sm text-state-success-fg font-medium">Granted</span>
      )}
      {state === 'denied' && (
        <span className="text-sm text-text-tertiary font-medium">Denied</span>
      )}
      {state === 'default' && (
        <button
          type="button"
          onClick={handleRequest}
          className="px-3 py-1 rounded text-sm font-medium bg-accent-primary text-text-inverse hover:opacity-90 transition-opacity"
        >
          Request
        </button>
      )}
    </SettingRow>
  );
}
