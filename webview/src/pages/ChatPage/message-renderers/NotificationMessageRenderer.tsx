import React from 'react';
import { LoadedMessageDto } from '../../../types';

interface NotificationMessageRendererProps {
  message: LoadedMessageDto;
}

export const NotificationMessageRenderer: React.FC<NotificationMessageRendererProps> = ({ message }) => {
  const text = message.summary;
  if (!text) return null;

  return (
    <div className="flex justify-center py-2">
      <span className="text-[0.8461rem] text-zinc-500 italic">{text}</span>
    </div>
  );
};
