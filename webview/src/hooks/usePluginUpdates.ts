import { useState, useEffect, useCallback } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { MessageType } from '@/shared';

interface PluginUpdate {
  id: number;
  pluginId: number;
  version: string;
  notes: string;     // HTML changelog
  channel?: string;
  cdate: string | number; // timestamp (string from API)
  since?: string;
  until?: string;
}

interface UsePluginUpdatesReturn {
  updates: PluginUpdate[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Module-level cache: persists across component mounts/unmounts
let cachedUpdates: PluginUpdate[] | null = null;

export function usePluginUpdates(): UsePluginUpdatesReturn {
  const { isConnected, send } = useBridgeContext();
  const [updates, setUpdates] = useState<PluginUpdate[]>(cachedUpdates ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await send(MessageType.GET_PLUGIN_UPDATES, {});
      if (result.status === 'ok') {
        const fetched: PluginUpdate[] = result.updates ?? [];
        cachedUpdates = fetched;
        setUpdates(fetched);
      } else {
        setError(result.error ?? 'Failed to fetch plugin updates');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.warn('Failed to fetch plugin updates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [send]);

  useEffect(() => {
    if (isConnected && !cachedUpdates) {
      fetchUpdates();
    }
  }, [isConnected, fetchUpdates]);

  return {
    updates,
    isLoading,
    error,
    refresh: fetchUpdates,
  };
}
