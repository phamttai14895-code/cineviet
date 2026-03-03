import { useState, useRef, useEffect } from 'react';

const EMOJI_LIST = [
  '😀', '😂', '🥲', '😍', '😎', '😉', '🥹', '😕',
  '😠', '🤔', '😪', '😟', '🥺', '😫', '😭', '👍',
  '👎', '👏', '🔥', '❤️', '💔', '💯', '⭐', '🎬',
  '🍿', '📺', '🎭', '🎉', '👹', '💀', '👻', '😈',
  '🤣', '😊', '🙂', '😢', '😤', '😨', '🤯', '😴',
];

export default function EmojiPicker({ onSelect, className = '' }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (emoji) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <div className={`emoji-picker-wrap ${className}`.trim()}>
      <button
        ref={btnRef}
        type="button"
        className={`emoji-picker-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Chèn emoji"
        aria-expanded={open}
      >
        <span className="emoji-picker-btn-icon">😊</span>
      </button>
      {open && (
        <div ref={panelRef} className="emoji-picker-panel" role="dialog" aria-label="Chọn emoji">
          <div className="emoji-picker-grid">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-picker-item"
                onClick={() => handleSelect(emoji)}
                aria-label={`Chèn ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
