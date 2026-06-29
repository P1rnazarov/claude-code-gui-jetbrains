import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { useWorkingDir } from '@/contexts/WorkingDirContext';
import { MessageType } from '@/shared';
import type { AccountUsage } from '@/shared';

export interface AllUsageQueryResponse {
  status: string;
  accounts: AccountUsage[];
  error?: string | null;
}

export interface UseAllUsageResult {
  accounts: AccountUsage[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
  refresh: () => Promise<void>;
}

export function useAllUsage(): UseAllUsageResult {
  const queryClient = useQueryClient();
  const { isConnected, send, subscribe } = useBridgeContext();
  const { workingDirectory } = useWorkingDir();

  const queryKey = [MessageType.GET_ALL_USAGE, workingDirectory];

  const query = useQuery<AllUsageQueryResponse, Error>({
    queryKey,
    enabled: isConnected,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = (await send(MessageType.GET_ALL_USAGE, {
        force: false,
        workingDir: workingDirectory ?? undefined,
      })) as AllUsageQueryResponse;
      if (res?.status === 'ok') {
        return res;
      }
      throw new Error(res?.error ?? 'Failed to load usage info');
    },
  });

  useEffect(() => {
    const unsubscribe = subscribe(MessageType.ACCOUNTS_CHANGED, () => {
      void queryClient.invalidateQueries({ queryKey });
    });
    return unsubscribe;
  }, [subscribe, queryClient, workingDirectory]);

  const refresh = useCallback(async () => {
    const res = (await send(MessageType.GET_ALL_USAGE, {
      force: true,
      workingDir: workingDirectory ?? undefined,
    })) as AllUsageQueryResponse;
    if (res?.status === 'ok') {
      queryClient.setQueryData(queryKey, res);
    } else {
      throw new Error(res?.error ?? 'Failed to refresh usage info');
    }
  }, [send, queryClient, workingDirectory]);

  return {
    accounts: query.data?.accounts ?? [],
    isLoading: query.isLoading,
    error: query.isError ? (query.error?.message ?? 'Unknown error') : null,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
    refetch: query.refetch,
    refresh,
  };
}
