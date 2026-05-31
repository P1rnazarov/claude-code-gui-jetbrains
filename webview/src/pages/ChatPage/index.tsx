import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { ChatInput } from './ChatInput';
import { SessionHeader } from './SessionHeader';
import { ChatMessageArea } from './ChatMessageArea';
import { PermissionBanner } from './PermissionBanner';
import { AskUserQuestionInputPanel } from './AskUserQuestionInputPanel';
import { AcceptPlanPanel } from './AcceptPlanPanel';
import { BannerArea } from './BannerArea';
import { UpdateBanner } from './UpdateBanner';
import { ConnectionLostBanner } from './ConnectionLostBanner';
import { BrowserPermissionBanner } from './BrowserPermissionBanner';
import { useChatInputFocus } from '../../contexts/ChatInputFocusContext';
import { useChatStreamContext } from '../../contexts/ChatStreamContext';
import { useSessionContext } from '../../contexts/SessionContext';
import { useAwaitingNotifications } from '../../hooks';
import { usePendingAskUserQuestion } from '../../hooks/usePendingAskUserQuestion';
import { usePendingPermissions } from '../../hooks/usePendingPermissions';
import { usePendingPlanApproval } from '../../hooks/usePendingPlanApproval';
import { useNotificationSound } from '@/notifications';
import {isMobile} from "@/config/environment.ts";

const SCROLL_THRESHOLD = 80;

export function ChatPage() {
  const { textareaRef, focus: focusInput } = useChatInputFocus();
  const { currentSessionId, currentSession } = useSessionContext();
  const { messages, isStreaming } = useChatStreamContext();
  const { pending: pendingUserAnswer, dismiss } = usePendingAskUserQuestion(messages, isStreaming);
  const { pending: pendingPermission, approve: approvePermission, approveForSession, deny: denyPermission } = usePendingPermissions();
  const { pending: pendingPlan, approve: approvePlan, deny: denyPlan } = usePendingPlanApproval();
  const { selection: soundSelection } = useNotificationSound();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);

  // Poll sentinel position every 200ms to detect near-bottom state.
  // Polling instead of scroll/IntersectionObserver because those are unreliable
  // in JCEF when the scrollable element differs from what listeners expect.
  useEffect(() => {
    const measure = () => {
      const s = sentinelRef.current;
      if (!s) return;
      const rect = s.getBoundingClientRect();
      const isNear = rect.top <= window.innerHeight + SCROLL_THRESHOLD;
      setIsUserNearBottom(prev => (prev === isNear ? prev : isNear));
    };
    measure();
    const id = setInterval(measure, 200);
    return () => clearInterval(id);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useAwaitingNotifications(currentSession?.title ?? null, soundSelection, {
    pendingPermission: pendingPermission !== null,
    pendingPlanApproval: pendingPlan !== null,
    pendingUserAnswer: pendingUserAnswer !== null,
  });

  // Save scroll position to localStorage (debounced via scroll event)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !currentSessionId) return;

    let saveTimer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        localStorage.setItem(`claude-gui:scroll:${currentSessionId}`, String(el.scrollTop));
      }, 300);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(saveTimer);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [currentSessionId]);

  // Restore scroll position after messages load
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const key = `claude-gui:scroll:${currentSessionId}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      requestAnimationFrame(() => {
        el.scrollTop = Number(cached);
      });
      localStorage.removeItem(key);
    }
  }, [currentSessionId, messages.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // 빈 영역 클릭 시 textarea로 포커스 이동
  // mousedown 시점에 확인해야 포커스 이동 전 activeElement를 비교할 수 있음
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"], [contenteditable]')) {
      return;
    }
    if (document.activeElement === textareaRef.current) {
      // 이미 포커스 상태 → 브라우저가 포커스를 빼앗지 못하게 방지
      // e.preventDefault();
      return;
    }
    e.preventDefault();
    focusInput();
  }, [textareaRef, focusInput]);

  return (
    <div className="flex flex-col w-full h-screen bg-surface-base text-text-primary fixed left-0 top-0" onMouseDown={handleContainerMouseDown}>
      {/* Header - Minimal */}
      <div className="fixed w-full top-0 bg-blend-darken bg-surface-base z-10">
        <SessionHeader />
      </div>

      <BannerArea>
        <UpdateBanner />
        <ConnectionLostBanner />
        <BrowserPermissionBanner />
      </BannerArea>

      {/* Messages Area */}
      <div ref={scrollContainerRef} className={`flex flex-col flex-1 overflow-y-auto w-full h-screen pt-10 ${isMobile() ? 'pb-52' : ''} bg-surface-base z-0`}>
        <ChatMessageArea
          isStreaming={isStreaming && !pendingUserAnswer && !pendingPlan && !pendingPermission}
          scrollContainerRef={scrollContainerRef}
          isUserNearBottom={isUserNearBottom}
          sentinelRef={sentinelRef}
        />

        {/* Input Area */}
        <div ref={bottomPanelRef} className="sticky w-full left-0 bottom-0 z-10">
          {pendingUserAnswer ? (
            <AskUserQuestionInputPanel
              toolUse={pendingUserAnswer.toolUse}
              controlRequestId={pendingUserAnswer.controlRequestId}
              onDismiss={() => dismiss(pendingUserAnswer.toolUse.id)}
            />
          ) : pendingPlan ? (
            <AcceptPlanPanel
              pending={pendingPlan}
              onApprove={approvePlan}
              onDeny={denyPlan}
            />
          ) : pendingPermission ? (
            <PermissionBanner
              permission={pendingPermission}
              onApprove={() => approvePermission(pendingPermission.controlRequestId)}
              onApproveForSession={() => approveForSession(pendingPermission.controlRequestId)}
              onDeny={(reason) => denyPermission(pendingPermission.controlRequestId, reason)}
            />
          ) : (
            <ChatInput />
          )}
        </div>

      </div>

      {!isUserNearBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-[7.5rem] left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised border border-border-default rounded-full shadow-md text-xs text-text-primary hover:bg-surface-hover transition-colors"
        >
          <ChevronDownIcon className="w-3.5 h-3.5" />
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
