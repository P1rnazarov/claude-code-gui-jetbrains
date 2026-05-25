import { useEffect, useRef } from 'react';
import { APP_NAME } from '@/config/app';
import {
  NotificationKind,
  notify,
  type SoundSelection,
} from '@/notifications';

const FAVICON_DEFAULT = '/favicon.svg';
const FAVICON_UNREAD = '/favicon-unread.svg';

function setFavicon(href: string) {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (link && link.href !== href) {
    link.href = href;
  }
}

/**
 * Hook to update the document title based on the current session and streaming state.
 *
 * Streaming state is communicated to the JetBrains IDE via a JCEF JS bridge
 * (`window.__notifyStreamingState`), NOT via document.title encoding
 * (Chromium normalizes tab characters in titles, breaking delimiter-based parsing).
 *
 * Also swaps the browser favicon to an unread variant when streaming ends
 * while the tab is hidden, and restores it when the tab becomes visible. In
 * the same condition, fires an OS desktop notification (no-op in JCEF, where
 * the Notification API is unavailable). The third argument is the user's
 * notification-sound preference (see `useNotificationSound`); the caller
 * passes it down so this hook stays decoupled from settings storage.
 */
export function useDocumentTitle(
  title: string | null,
  isStreaming: boolean,
  soundSelection: SoundSelection,
) {
  const wasStreamingRef = useRef(false);
  const hasUnreadRef = useRef(false);

  // Keep latest values in refs so the streaming-end effect always sees them
  // without rebinding on every render.
  const titleRef = useRef(title);
  const soundSelectionRef = useRef(soundSelection);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    soundSelectionRef.current = soundSelection;
  }, [soundSelection]);

  useEffect(() => {
    document.title = title || APP_NAME;
  }, [title]);

  // Notify JCEF of streaming state changes
  useEffect(() => {
    const notifyJcef = (window as unknown as Record<string, unknown>).__notifyStreamingState;
    if (typeof notifyJcef === 'function') {
      (notifyJcef as (state: string) => void)(isStreaming ? 'streaming' : 'idle');
    }
  }, [isStreaming]);

  // Detect streaming end while tab is hidden → show unread favicon + desktop notification
  useEffect(() => {
    if (!isStreaming && wasStreamingRef.current && document.hidden) {
      hasUnreadRef.current = true;
      setFavicon(FAVICON_UNREAD);
      notify(
        NotificationKind.SESSION_COMPLETE,
        { sessionTitle: titleRef.current },
        soundSelectionRef.current,
      );
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Restore favicon when tab becomes visible
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden && hasUnreadRef.current) {
        hasUnreadRef.current = false;
        setFavicon(FAVICON_DEFAULT);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
}
