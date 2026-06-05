import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ClipboardEvent as ReactClipboardEvent,
  type CompositionEvent as ReactCompositionEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { setCaretOffset } from '@/utils/domSelection';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (e: ReactClipboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * RichInput — a `contentEditable="plaintext-only"` div that behaves like a
 * controlled <textarea> for plain text. Mirrors the Claude Code extension
 * composer: plaintext-only (Chromium/JCEF-safe, IME-friendly), CSS placeholder
 * via `data-placeholder` on `:empty`, and CSS-only auto-grow (no resize hook).
 *
 * This stage renders opaque plain text only — no syntax highlight / mirror.
 *
 * value ↔ textContent sync rule: the DOM is only rewritten when it actually
 * diverges from `value`, so user typing never triggers a caret-jumping reset.
 * External (programmatic) value changes move the caret to the end. While an IME
 * composition is in flight, the sync is skipped so the in-progress glyphs are
 * never clobbered.
 */
export const RichInput = forwardRef<HTMLDivElement, Props>((props: Props, ref) => {
  const {
    value,
    onChange,
    onKeyDown,
    onPaste,
    onFocus,
    onBlur,
    placeholder,
    disabled = false,
    className,
    ariaLabel,
  } = props;

  const elRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // Expose the editable div to the parent (focus / domSelection utilities) while
  // keeping our own internal ref for sync work.
  useImperativeHandle(ref, () => elRef.current as HTMLDivElement, []);

  // value → DOM sync. Only writes when the DOM diverges from `value` (prevents
  // caret jumps on every keystroke) and never during IME composition.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (el === null) return;
    if (isComposingRef.current) return;

    const current = el.textContent ?? '';
    if (current === value) return;

    el.textContent = value;

    // Only reposition the caret when this element is focused, so background
    // (programmatic) updates don't steal the selection from elsewhere.
    if (document.activeElement === el) {
      setCaretOffset(el, value.length);
    }
  }, [value]);

  const handleInput = useCallback(
    (e: FormEvent<HTMLDivElement>) => {
      // During composition the intermediate text is not yet committed; defer
      // reporting until compositionend to avoid emitting partial glyphs.
      if (isComposingRef.current) return;
      onChange(e.currentTarget.textContent ?? '');
    },
    [onChange],
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (e: ReactCompositionEvent<HTMLDivElement>) => {
      isComposingRef.current = false;
      onChange(e.currentTarget.textContent ?? '');
    },
    [onChange],
  );

  return (
    <div
      ref={elRef}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline="true"
      contentEditable={disabled ? false : 'plaintext-only'}
      spellCheck={false}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={[
        'w-full px-3 cursor-text bg-transparent text-base text-text-primary',
        'min-h-[20px] max-h-[200px] overflow-y-auto',
        'whitespace-pre-wrap break-words',
        'focus:outline-none',
        disabled ? 'opacity-50' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onFocus={onFocus}
      onBlur={onBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  );
});

RichInput.displayName = 'RichInput';
