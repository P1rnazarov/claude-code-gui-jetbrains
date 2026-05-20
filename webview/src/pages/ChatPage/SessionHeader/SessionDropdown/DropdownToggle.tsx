import { ChevronDownIcon } from '@heroicons/react/20/solid';

interface DropdownToggleProps {
  sessionTitle: string;
  isOpen: boolean;
  onClick: () => void;
}

export function DropdownToggle({ sessionTitle, isOpen, onClick }: DropdownToggleProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 text-[1rem] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 rounded transition-colors min-w-0 max-w-full"
    >
      <span className="min-w-0 max-w-[260px] truncate">{sessionTitle || 'New Chat'}</span>
      <ChevronDownIcon className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}
