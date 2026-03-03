import { useRef } from 'react';
import EmojiPicker from './EmojiPicker';

function insertEmojiAtCursor(value, selectionStart, selectionEnd, emoji) {
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  const newValue = value.slice(0, start) + emoji + value.slice(end);
  return newValue;
}

export default function CommentInputWithEmoji({ value, onChange, className = '', inputClassName = '', ...textareaProps }) {
  const textareaRef = useRef(null);

  const handleEmojiSelect = (emoji) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const newValue = insertEmojiAtCursor(value, start, end, emoji);
    onChange(newValue);
    el.focus();
    setTimeout(() => {
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className={`comment-input-with-emoji ${className}`.trim()}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
        {...textareaProps}
      />
      <EmojiPicker onSelect={handleEmojiSelect} className="comment-input-emoji-picker" />
    </div>
  );
}
