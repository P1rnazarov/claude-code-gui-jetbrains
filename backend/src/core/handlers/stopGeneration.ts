import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { sendInterruptToProcess } from '../claude-process';
import { MessageType } from '../../shared';

export function stopGenerationHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): void {
  const client = connections.getClient(connectionId);
  if (client?.subscribedSessionId) {
    const sessionId = client.subscribedSessionId;
    const session = connections.getSession(sessionId);
    if (session?.process) {
      console.error('[node-backend]', `Interrupting generation for session ${sessionId} via stdin control_request`);
      const sent = sendInterruptToProcess(connections, sessionId);
      if (!sent) {
        console.error('[node-backend]', `Interrupt failed, falling back to SIGTERM for ${sessionId}`);
        session.process.kill('SIGTERM');
      }
    }
  }
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
