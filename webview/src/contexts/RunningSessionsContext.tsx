import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useBridgeContext } from './BridgeContext';
import { MessageType } from '@/shared';

interface RunningSessionsContextType {
  running: Set<string>;
}

const RunningSessionsContext = createContext<RunningSessionsContextType | null>(null);

export function RunningSessionsProvider({ children }: { children: ReactNode }) {
  const { isConnected, send, subscribe } = useBridgeContext();
  const [running, setRunning] = useState<Set<string>>(new Set());

  // 1. Initial load on connection
  useEffect(() => {
    if (isConnected) {
      send(MessageType.GET_RUNNING_SESSIONS)
        .then((res: any) => {
          if (res?.sessionIds) {
            setRunning(new Set(res.sessionIds));
          }
        })
        .catch((err) => {
          console.error('[RunningSessionsProvider] Failed to fetch running sessions:', err);
        });
    } else {
      setRunning(new Set());
    }
  }, [isConnected, send]);

  // 2. Subscribe to push updates
  useEffect(() => {
    const unsubscribe = subscribe(MessageType.RUNNING_SESSIONS, (msg: any) => {
      if (msg?.payload?.sessionIds) {
        setRunning(new Set(msg.payload.sessionIds));
      }
    });
    return unsubscribe;
  }, [subscribe]);

  return (
    <RunningSessionsContext.Provider value={{ running }}>
      {children}
    </RunningSessionsContext.Provider>
  );
}

export function useRunningSessionsContext() {
  const context = useContext(RunningSessionsContext);
  return context;
}
