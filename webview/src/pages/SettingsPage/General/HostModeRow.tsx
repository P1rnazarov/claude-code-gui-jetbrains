import { SettingRow } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey, HostMode } from '@/types/settings';
import { isJetBrains } from '@/config/environment';

const HOST_MODE_OPTIONS: SelectOption[] = [
  { value: HostMode.TOOL_WINDOW, label: 'Sidebar' },
  { value: HostMode.EDITOR_TAB, label: 'Panel' },
];

/**
 * Lets the user choose where new chats open — a dedicated editor tab or the
 * Claude Code tool window. Only meaningful inside the JetBrains IDE, so it is
 * hidden in the browser (standalone) runtime.
 *
 * Rendered as a row inside the General app section. Host mode is an IDE-global
 * behaviour (the Kotlin SettingsManager reads it from the global settings file
 * only), so it is always written to the global scope regardless of the active
 * settings scope tab.
 */
export function HostModeRow() {
  const { settings, updateSettingWithScope } = useSettings();

  if (!isJetBrains()) return null;

  const hostMode = settings[SettingKey.HOST_MODE] ?? HostMode.EDITOR_TAB;

  return (
    <SettingRow
      label="Preferred Location"
      description="Where Claude opens by default."
    >
      <Select
        value={hostMode}
        options={HOST_MODE_OPTIONS}
        ariaLabel="Preferred Location"
        className="bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
        onChange={(value) => updateSettingWithScope(SettingKey.HOST_MODE, value as HostMode, 'global')}
      />
    </SettingRow>
  );
}
