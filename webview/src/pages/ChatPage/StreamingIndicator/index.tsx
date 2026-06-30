import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ICON_FRAMES, TEXT_CHANGE_DELAYS, VERBS } from './constants.ts';
import { useScramble } from './useScramble.ts';
import { randomPick } from './utils.ts';
import { formatThinkingTokens } from '@/utils/formatThinkingTokens.ts';

export function formatElapsed(elapsedMs: number): string {
    const seconds = Math.floor(elapsedMs / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

export interface StreamingIndicatorProps {
    meta?: {
        startedAt: number | null;
        tokens: number;
    };
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({ meta }) => {
    // 아이콘 프레임 인덱스
    const [frameIdx, setFrameIdx] = useState(0);

    // 현재 동사
    const [verb, setVerb] = useState<string>(() => randomPick(VERBS));

    // 텍스트 변경 카운트 (딜лей 스케줄 추적)
    const changeCountRef = useRef<number>(0);
    const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 경과 시간 (ms)
    const [elapsed, setElapsed] = useState(0);

    // 다음 텍스트 변경 딜레이 계산
    const getNextDelay = useCallback(() => {
        const count = changeCountRef.current;
        if (count === 0) return TEXT_CHANGE_DELAYS[0];
        if (count === 1) return TEXT_CHANGE_DELAYS[1];
        return TEXT_CHANGE_DELAYS[2];
    }, []);

    // 텍스트 변경 스케줄링
    const scheduleNextChange = useCallback((currentVerb: string) => {
        if (textTimerRef.current !== null) {
            clearTimeout(textTimerRef.current);
        }
        const delay = getNextDelay();
        textTimerRef.current = setTimeout(() => {
            const next = randomPick(VERBS, currentVerb as typeof VERBS[number]);
            changeCountRef.current += 1;
            setVerb(next);
        }, delay);
    }, [getNextDelay]);

    // 아이콘 인터벌 (120ms)
    useEffect(() => {
        const interval = setInterval(() => {
            setFrameIdx((prev) => (prev + 1) % ICON_FRAMES.length);
        }, 120);
        return () => clearInterval(interval);
    }, []);

    // 텍스트 변경 스케줄 초기화
    useEffect(() => {
        scheduleNextChange(verb);
        // verb가 바뀔 때마다 다음 변경을 재스케줄
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verb]);

    // cleanup
    useEffect(() => {
        return () => {
            if (textTimerRef.current !== null) {
                clearTimeout(textTimerRef.current);
            }
        };
    }, []);

    // 경과 시간 타이머
    useEffect(() => {
        if (!meta?.startedAt) {
            setElapsed(0);
            return;
        }

        setElapsed(Date.now() - meta.startedAt);

        const timer = setInterval(() => {
            if (meta?.startedAt) {
                setElapsed(Date.now() - meta.startedAt);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [meta?.startedAt]);

    // 스크램블 디스플레이
    const displayText = useScramble(verb);

    const tokenStr = meta ? formatThinkingTokens(meta.tokens) : null;
    const elapsedStr = meta?.startedAt ? formatElapsed(elapsed) : null;

    return (
        <div>
            <div className="group pt-2 pb-4 pl-[22px] pr-3">
                <div className="flex items-start gap-3">
                    {/* 아이콘 프레임 */}
                    <span className="text-accent-primary mt-[3px] text-[0.8461rem] leading-none select-none w-3 text-center shrink-0">
                        {ICON_FRAMES[frameIdx]}
                    </span>

                    {/* 스크램블 텍스트 */}
                    <div className="flex-1 min-w-0">
                        <span className="text-text-tertiary text-base font-mono">
                            {displayText}...
                            {elapsedStr && (
                                <span className="text-text-tertiary ml-2 select-none opacity-60">
                                    · {elapsedStr}{tokenStr ? ` · ${tokenStr}` : ''}
                                </span>
                            )}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
