import React from 'react';
import { LoadedMessageDto } from '../../../types';

interface InterruptedMessageRendererProps {
  message: LoadedMessageDto;
  label?: string;
}

export const InterruptedMessageRenderer: React.FC<InterruptedMessageRendererProps> = ({ label }) => {
  return (
    <div className="mt-[18px] mb-[12px] py-2 px-4">
      <div className="flex items-center gap-1.5 text-[1rem] text-white/60 italic">
        {label ?? 'interrupted'}
      </div>
    </div>
  );
};
