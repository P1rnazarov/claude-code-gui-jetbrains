import { useRouter, Route } from '@/router';
import { SettingsLayout } from './SettingsLayout';
import { GeneralSettings } from './General';
import { AppearanceSettings } from './Appearance';
import { PermissionsSettings } from './Permissions';
import { CliSettings } from './Cli';
import { AdvancedSettings } from './Advanced';
import { TunnelSettings } from './Tunnel';
import { AboutSettings } from './About';
import { UsageSettings } from './Usage';
import { ReleasesSettings } from './Releases';
import { AccountSettings } from './Account';
import { BrowserSettings } from './Browser';

/**
 * Settings 메인 컴포넌트 - 현재 라우트에 따라 적절한 설정 페이지 렌더링
 */
export function SettingsPage() {
  const { route } = useRouter();

  const renderContent = () => {
    switch (route) {
      case Route.SETTINGS_GENERAL:
        return <GeneralSettings />;
      case Route.SETTINGS_APPEARANCE:
        return <AppearanceSettings />;
      case Route.SETTINGS_PERMISSIONS:
        return <PermissionsSettings />;
      case Route.SETTINGS_CLI:
        return <CliSettings />;
      case Route.SETTINGS_ADVANCED:
        return <AdvancedSettings />;
      case Route.SETTINGS_TUNNEL:
        return <TunnelSettings />;
      case Route.SETTINGS_BROWSER:
        return <BrowserSettings />;
      case Route.SETTINGS_ACCOUNT:
        return <AccountSettings />;
      case Route.SETTINGS_ABOUT:
        return <AboutSettings />;
      case Route.SETTINGS_USAGE:
        return <UsageSettings />;
      case Route.SETTINGS_RELEASES:
        return <ReleasesSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <SettingsLayout>
      {renderContent()}
    </SettingsLayout>
  );
}
