import { ROUTE_META, Route } from '@/router/routes';
import { PermissionsSection } from './PermissionsSection';
import { NotificationsSection } from './NotificationsSection';

interface Props {
  className?: string;
}

export const BrowserSettings = (props: Props) => {
  const { className = '' } = props;
  const meta = ROUTE_META[Route.SETTINGS_BROWSER];

  return (
    <div className={className}>
      <h2 className="text-xl font-semibold text-text-primary mb-6">{meta.label}</h2>
      <PermissionsSection />
      <NotificationsSection />
    </div>
  );
};
