import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OptionButton, OptionItem } from './OptionButton';
import { useApprovalKeyboard } from './useApprovalKeyboard';

interface Props {
  title: string;
  subtitle?: string;
  options: OptionItem[];
  onOptionSelect: (index: number) => void;
  textareaPlaceholder?: string;
  onTextSubmit?: (text: string) => void;
  onCancel: () => void;
}

export function ApprovalPanel(props: Props) {
  const { title, subtitle, options, onOptionSelect, textareaPlaceholder = 'Tell Claude what to do instead', onTextSubmit, onCancel } = props;

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    autoResize();
  }, [feedbackText, autoResize]);

  const handleOptionClick = useCallback((index: number) => {
    setFocusedIndex(index);
    onOptionSelect(index);
  }, [onOptionSelect]);

  const handleTextSubmit = useCallback(() => {
    const text = feedbackText.trim();
    if (text && onTextSubmit) {
      onTextSubmit(text);
      setFeedbackText('');
    }
  }, [feedbackText, onTextSubmit]);

  const { handleInputKeyDown } = useApprovalKeyboard({
    optionCount: options.length,
    focusedIndex,
    setFocusedIndex,
    handleOptionClick,
    handleTextSubmit,
    onCancel,
  });

  useEffect(() => {
    if (focusedIndex === options.length) textareaRef.current?.focus();
  }, [focusedIndex, options.length]);

  return (
    <div className="max-w-[44rem] mx-auto px-4 pb-[20px] pt-2">
      <div className="rounded-lg border border-zinc-700 bg-[#1e1e21] overflow-hidden">
        {/* 헤더 */}
        <div className="px-2 py-2.5 mb-0.5">
          <p className="text-[1.0769rem] font-semibold text-zinc-100 leading-snug">{title}</p>
          {subtitle && (
            <p className="text-[1rem] text-zinc-400 mt-1">{subtitle}</p>
          )}
        </div>

        {/* 옵션 목록 */}
        <div className="px-2 flex flex-col gap-[7px]">
          {options.map((opt, idx) => (
            <OptionButton
              key={opt.key}
              option={opt}
              isFocused={focusedIndex === idx}
              onClick={() => handleOptionClick(idx)}
              onFocus={() => setFocusedIndex(idx)}
            />
          ))}

          {/* 자유 텍스트 입력 */}
          {onTextSubmit && (
            <textarea
              ref={textareaRef}
              value={feedbackText}
              rows={1}
              tabIndex={0}
              onFocus={() => setFocusedIndex(options.length)}
              onChange={e => setFeedbackText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={textareaPlaceholder}
              className="w-full bg-transparent text-[1rem] px-2.5 py-[5px] text-zinc-200 placeholder-zinc-500 focus:outline-none border border-zinc-400/20 rounded-[4px] text-left font-normal transition-colors duration-100 resize-none overflow-hidden"
            />
          )}
        </div>

        {/* 푸터 */}
        <div className="px-2 pb-2 pt-0.5">
          <span className="text-[0.8461rem] text-zinc-400">Esc to cancel</span>
        </div>
      </div>
    </div>
  );
}
