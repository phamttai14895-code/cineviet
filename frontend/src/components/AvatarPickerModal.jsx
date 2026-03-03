import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PRESET_AVATARS } from '../data/presetAvatars';

export default function AvatarPickerModal({ open, onClose, currentAvatarUrl, onSave }) {
  const [selectedUrl, setSelectedUrl] = useState(currentAvatarUrl || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedUrl(currentAvatarUrl || '');
  }, [currentAvatarUrl, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!selectedUrl) return;
    setSaving(true);
    try {
      await onSave(selectedUrl);
      onClose();
    } catch (e) {
      // onSave may show error
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div
      className="modal-overlay avatar-picker-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-picker-title"
    >
      <div className="modal avatar-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="avatar-picker-head">
          <h2 id="avatar-picker-title" className="avatar-picker-title">Đổi ảnh đại diện</h2>
          <button type="button" className="modal-close avatar-picker-close" onClick={onClose} aria-label="Đóng">
            <i className="fas fa-times" />
          </button>
        </div>
        <p className="avatar-picker-subtitle">Avatar ngẫu nhiên</p>

        <div className="avatar-picker-grid-wrap">
          <div className="avatar-picker-grid">
            {PRESET_AVATARS.map((url) => (
              <button
                key={url}
                type="button"
                className={`avatar-picker-item ${selectedUrl === url ? 'selected' : ''}`}
                onClick={() => setSelectedUrl(url)}
              >
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div className="avatar-picker-actions">
          <button
            type="button"
            className="btn avatar-picker-btn-save"
            onClick={handleSave}
            disabled={saving || !selectedUrl}
          >
            {saving ? 'Đang lưu...' : 'Lưu lại'}
          </button>
          <button type="button" className="btn avatar-picker-btn-close" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
