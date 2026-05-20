import React from 'react';
import { LoadedMessageDto } from '../../../types';

interface SummaryMessageRendererProps {
  message: LoadedMessageDto;
}

export const SummaryMessageRenderer: React.FC<SummaryMessageRendererProps> = ({ message }) => {
  const summaryText = message.summary;
  if (!summaryText) return null;

  return (
    <div className="flex justify-center py-2">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/30 border border-zinc-700/30 rounded-full text-[0.8461rem] text-zinc-500">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-zinc-500">
          <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 4h10M4 7h8M5 10h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        </svg>
        <span className="italic">{summaryText}</span>
      </div>
    </div>
  );
};
