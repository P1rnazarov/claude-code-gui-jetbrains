import { useRunningSessionsContext } from '@/contexts/RunningSessionsContext';

const DEFAULT_RUNNING = new Set<string>();

export function useRunningSessions() {
  const context = useRunningSessionsContext();
  return { running: context?.running ?? DEFAULT_RUNNING };
}
