import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { sendToolResultToProcess, sendControlResponseToProcess } from '../claude-process';
import { MessageType } from '../../shared';

/** WebView -> Backend TOOL_RESPONSE payload */
interface ToolResponsePayload {
  toolUseId: string;
  approved: boolean;
  controlRequestId?: string;
  updatedInput?: Record<string, unknown>;
  reason?: string;
  result?: string;
}

export function toolResponseHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): void {
  const client = connections.getClient(connectionId);
  const sessionId = client?.subscribedSessionId;

  if (!sessionId) {
    console.error('[node-backend]', 'TOOL_RESPONSE received but no subscribed session');
    connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
    return;
  }

  const payload = message.payload as ToolResponsePayload | undefined;
  const toolUseId = payload?.toolUseId ?? '';
  const approved = payload?.approved ?? true;
  const controlRequestId = payload?.controlRequestId;

  if (controlRequestId) {
    // AskUserQuestion: control_response 프로토콜
    const response = {
      subtype: 'success' as const,
      request_id: controlRequestId,
      response: approved
        ? { behavior: 'allow', updatedInput: payload?.updatedInput ?? {} }
        : { behavior: 'deny', message: payload?.reason || 'User declined to answer' },
    };
    sendControlResponseToProcess(connections, sessionId, response);
    console.error('[node-backend]', `CONTROL_RESPONSE sent for request ${controlRequestId} (approved: ${approved})`);
  } else {
    // 일반 tool permission: tool_result 방식
    const resultContent =
      payload?.result ||
      (approved ? 'Tool execution approved' : 'Tool execution rejected');

    const toolResult = {
      type: 'tool_result' as const,
      tool_use_id: toolUseId,
      content: resultContent,
      is_error: !approved,
    };
    sendToolResultToProcess(connections, sessionId, toolResult);
    console.error('[node-backend]', `TOOL_RESPONSE sent for tool ${toolUseId} (approved: ${approved})`);
  }

  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
