interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'normal';
  ariaLabel?: string;
}

export const ToggleSwitch = (props: Props) => {
  const { checked, onChange, disabled = false, size = 'normal', ariaLabel } = props;

  const isSmall = size === 'small';
  const trackClass = isSmall ? 'h-4 w-7' : 'h-6 w-11';
  const knobClass = isSmall ? 'h-3 w-3' : 'h-4 w-4';
  const knobOn = isSmall ? 'translate-x-3.5' : 'translate-x-6';
  const knobOff = isSmall ? 'translate-x-0.5' : 'translate-x-1';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex flex-shrink-0 items-center rounded-full transition-colors ${trackClass} ${
        checked ? 'bg-blue-500' : 'bg-zinc-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block transform rounded-full bg-white transition-transform ${knobClass} ${
          checked ? knobOn : knobOff
        }`}
      />
    </button>
  );
};
