import { useEffect, useState } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}

export function ConnectionLostBanner() {
  const { isConnected } = useBridgeContext();
  const isOnline = useOnlineStatus();
  const [dots, setDots] = useState('');

  const showBanner = !isConnected || !isOnline;

  useEffect(() => {
    if (!showBanner) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, [showBanner]);

  if (!showBanner) return null;

  const message = !isOnline
    ? `No internet connection. Waiting for network${dots}`
    : `Backend disconnected. Reconnecting${dots}`;

  return (
    <div className="w-full z-20 border-t border-b border-yellow-800 bg-yellow-900/40 px-4 py-1.5 flex items-center">
      <span className="text-yellow-200 text-[0.8461rem]">
        {message}
      </span>
    </div>
  );
}
