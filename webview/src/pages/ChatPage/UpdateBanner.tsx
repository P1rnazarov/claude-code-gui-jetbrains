import { useUpdateAvailable } from '@/hooks/useUpdateAvailable';
import { useBridgeContext } from '@/contexts/BridgeContext';

function extractTitle(latestVersion: string | null,notes: string): string {
  const match = notes.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
  const title = match ? match[1] : null;
  if (title && latestVersion) {
    return title.replace(`${latestVersion} - `, '');;
  }
  return '';
}

export function UpdateBanner() {
  const { hasUpdate, latestVersion, latestNotes, requiresRestart, skip } = useUpdateAvailable();
  const { send } = useBridgeContext();

  if (!hasUpdate || !latestVersion) return null;

  const handleUpdate = () => {
    send('UPDATE_PLUGIN', {});
  };

  const title = latestNotes ? extractTitle(latestVersion, latestNotes) : '';

  return (
      <div className="w-full z-20 border-t border-b border-blue-800 bg-blue-900/40 px-4 py-1.5 flex items-center">
        <span className="text-white text-[0.8461rem]">
          <strong>v{latestVersion} released!</strong>
          {title && <span className="ml-2 text-blue-200 text-[0.7692rem]">{title}</span>}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {requiresRestart && <span className="ml-2 text-blue-200 text-[0.7692rem]">IDE restart required</span>}
          <button
              onClick={handleUpdate}
              className="px-3 py-1 rounded text-[0.7692rem] font-medium bg-white text-blue-700 hover:bg-blue-50 transition-colors"
          >
            Update
          </button>
          <button
              onClick={skip}
              className="px-3 py-1 rounded text-[0.7692rem] font-medium text-blue-100 hover:text-white hover:bg-blue-500 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
  );
}
