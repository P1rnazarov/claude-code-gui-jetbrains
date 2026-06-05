export interface IPCMessage {
  type: string;
  requestId?: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Native drag-and-drop entry. Produced by Kotlin CefDragHandler (one entry per
 * file in the drag), stashed against the panel's connection, and replayed to the
 * webview on NATIVE_DROP_FLUSH as the payload.entries[] of NATIVE_DROP_ENTRIES.
 */
export interface NativeDropEntry {
  path: string;
  type: 'file' | 'folder';
}
