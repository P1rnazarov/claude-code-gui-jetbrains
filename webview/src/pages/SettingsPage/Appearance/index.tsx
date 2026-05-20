import { SettingSection, SettingRow } from '../common';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey, ThemeMode } from '@/types/settings';
import { ROUTE_META, Route } from '@/router/routes';

const NOT_SET_VALUE = '__NOT_SET__';

export function AppearanceSettings() {
  const { scopeSettings, updateSetting, scope, resetToGlobal } = useSettings();
  const meta = ROUTE_META[Route.SETTINGS_APPEARANCE];

  const rawTheme = scopeSettings[SettingKey.THEME] as ThemeMode | undefined;
  const isThemeNotSet = rawTheme === undefined && scope === 'project';
  const themeValue = isThemeNotSet ? NOT_SET_VALUE : (rawTheme ?? ThemeMode.SYSTEM);

  const rawFontSize = scopeSettings[SettingKey.FONT_SIZE] as number | undefined;
  const isFontSizeNotSet = rawFontSize === undefined && scope === 'project';

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">
        {meta.label}
        <span className="ml-2 text-sm font-normal text-zinc-500">Coming Soon</span>
      </h2>

      <SettingSection title="Theme">
        <SettingRow
          label="Color Theme"
          description="Choose the color theme for the interface"
        >
          <select
            value={themeValue}
            onChange={(e) => {
              const value = e.target.value;
              if (value === NOT_SET_VALUE) {
                resetToGlobal(SettingKey.THEME);
                return;
              }
              updateSetting(SettingKey.THEME, value as ThemeMode);
            }}
            className={`bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm ${
              isThemeNotSet ? 'text-zinc-500 italic' : 'text-zinc-100'
            }`}
          >
            {scope === 'project' && (
              <option value={NOT_SET_VALUE} className="text-zinc-500">
                Not set (use global)
              </option>
            )}
            <option value={ThemeMode.SYSTEM}>System</option>
            <option value={ThemeMode.LIGHT}>Light</option>
            <option value={ThemeMode.DARK}>Dark</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Font Size"
          description="Base font size for the interface"
        >
          <input
            type="number"
            min="8"
            max="32"
            value={isFontSizeNotSet ? '' : (rawFontSize ?? 13)}
            placeholder={isFontSizeNotSet ? 'Not set' : undefined}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '') {
                if (scope === 'project') {
                  resetToGlobal(SettingKey.FONT_SIZE);
                }
                return;
              }
              updateSetting(SettingKey.FONT_SIZE, parseInt(value, 10));
            }}
            className={`w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm ${
              isFontSizeNotSet ? 'text-zinc-500 italic' : 'text-zinc-100'
            }`}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
