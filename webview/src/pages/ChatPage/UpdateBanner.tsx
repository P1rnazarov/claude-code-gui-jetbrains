import { useUpdateAvailable } from '@/hooks/useUpdateAvailable';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { isBrowser } from '@/config/environment';
import { MessageType } from '@/shared';

function extractTitle(latestVersion: string | null, notes: string): string {
  const match = notes.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
  const title = match ? match[1] : null;
  if (title && latestVersion) {
    return title.replace(`${latestVersion} - `, '');
  }
  return '';
}

export function UpdateBanner() {
  const { hasUpdate, latestVersion, latestNotes, requiresRestart, skip } = useUpdateAvailable();
  const { send } = useBridgeContext();

  if (!hasUpdate || !latestVersion) return null;

  const handleUpdate = () => {
    send(MessageType.UPDATE_PLUGIN, {});
  };

  const title = latestNotes ? extractTitle(latestVersion, latestNotes) : '';
  const showActions = !isBrowser();

  return (
      <div className="w-full z-20 border-t border-b border-state-info-border bg-state-info-bg px-4 py-1.5 flex items-center gap-2">
        <span className="text-text-primary text-[0.8461rem] flex-1 min-w-0 truncate sm:whitespace-normal sm:overflow-visible">
          <strong>v{latestVersion} released!</strong>
          {title && <span className="ml-2 text-text-link text-[0.7692rem]">{title}</span>}
        </span>

        {showActions && (
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {requiresRestart && <span className="ml-2 text-text-link text-[0.7692rem]">IDE restart required</span>}
            <button
                onClick={handleUpdate}
                className="px-3 py-1 rounded text-[0.7692rem] font-medium bg-surface-base text-text-link hover:bg-state-info-bg transition-colors"
            >
              Update
            </button>
            <button
                onClick={skip}
                className="px-3 py-1 rounded text-[0.7692rem] font-medium text-text-link hover:text-text-primary hover:bg-accent-primary transition-colors"
            >
              Skip
            </button>
          </div>
        )}
      </div>
  );
}
