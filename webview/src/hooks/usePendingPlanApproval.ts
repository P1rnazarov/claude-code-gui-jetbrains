import { useState, useCallback, useEffect, useRef } from 'react';
import { useApi } from '@/contexts/ApiContext';
import { getBridgeClient } from '@/api/bridge/BridgeClient';
import type { CliControlRequestEvent } from '@/types';
import { MessageType } from '@/shared';

export interface PendingPlanApproval {
  controlRequestId: string;
  toolUseId: string;
  input: Record<string, unknown>;
}

export function usePendingPlanApproval(): {
  pending: PendingPlanApproval | null;
  approve: (controlRequestId: string) => void;
  deny: (controlRequestId: string, reason?: string) => void;
} {
  const api = useApi();
  const [requests, setRequests] = useState<PendingPlanApproval[]>([]);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Subscribe to CLI_EVENT for control_request (ExitPlanMode only)
  useEffect(() => {
    const bridge = getBridgeClient();
    const unsubscribe = bridge.subscribe(MessageType.CLI_EVENT, (message) => {
      const cliEvent = message.payload as CliControlRequestEvent | undefined;
      if (cliEvent?.type !== 'control_request') return;

      const request = cliEvent?.request;

      // Only handle ExitPlanMode
      if (!request || request.subtype !== 'can_use_tool' || request.tool_name !== 'ExitPlanMode') {
        return;
      }

      const controlRequestId = cliEvent.request_id as string;
      const toolUseId = request.tool_use_id as string;
      const input = (request.input || {}) as Record<string, unknown>;

      if (!controlRequestId || processedIdsRef.current.has(controlRequestId)) return;

      setRequests(prev => [...prev, { controlRequestId, toolUseId, input }]);
    });
    return unsubscribe;
  }, []);

  const approve = useCallback((controlRequestId: string) => {
    const req = requests.find(r => r.controlRequestId === controlRequestId);
    if (!req) return;

    processedIdsRef.current.add(controlRequestId);

    api.tools.approve(req.toolUseId, controlRequestId, req.input);
    setRequests(prev => prev.filter(r => r.controlRequestId !== controlRequestId));
  }, [requests, api.tools]);

  const deny = useCallback((controlRequestId: string, reason?: string) => {
    const req = requests.find(r => r.controlRequestId === controlRequestId);
    if (!req) return;

    processedIdsRef.current.add(controlRequestId);

    api.tools.deny(req.toolUseId, controlRequestId, reason);
    setRequests(prev => prev.filter(r => r.controlRequestId !== controlRequestId));
  }, [requests, api.tools]);

  // Return the first pending request (FIFO)
  const pending = requests.length > 0 ? requests[0] : null;

  return { pending, approve, deny };
}
