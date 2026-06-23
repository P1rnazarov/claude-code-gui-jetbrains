import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';

/**
 * Webview-side trigger that releases the paths CefDragHandler stashed on drag-enter.
 *
 * Flow: Kotlin CefDragHandler.onDragEnter → /rpc NATIVE_DROP notification → backend
 * stashes paths against the panelId. When the user actually releases the mouse, the
 * webview's HTML5 `drop` handler fires this RPC. The backend looks up the stash for
 * this connection's panel and pushes the paths back as NATIVE_DROP_ENTRIES, which
 * ChatInput's subscribe handler turns into attachment chips.
 *
 * No-op (but still ACKs) when there's no stash — e.g. drops that originated inside
 * the page (image paste), or stale flushes after the stash was already consumed.
 */
export async function nativeDropFlushHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const entries = connections.takeNativeDropStash(connectionId);
  if (entries && entries.length > 0) {
    connections.sendTo(connectionId, MessageType.NATIVE_DROP_ENTRIES, { entries });
  }
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
