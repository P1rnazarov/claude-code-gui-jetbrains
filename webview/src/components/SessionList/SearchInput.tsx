import { SessionRefresher } from './SessionRefresher';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput(props: Props) {
  const { value, onChange } = props;

  return (
    <div className="p-1.5">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs bg-surface-overlay text-text-secondary px-2.5 py-1.5 pr-7 rounded outline-none placeholder:text-text-tertiary"
          placeholder="Search sessions..."
          autoFocus
        />
        <SessionRefresher />
      </div>
    </div>
  );
}
