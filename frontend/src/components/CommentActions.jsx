import { useState, useRef, useEffect } from 'react';

export default function CommentActions({
  commentId,
  isOwn,
  onEdit,
  onDelete,
  onReport,
  reportDisabled,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  return (
    <div className="movie-detail-comment-actions-wrap">
      {isOwn && (
        <div className="movie-detail-comment-menu" ref={menuRef}>
          <button
            type="button"
            className="movie-detail-comment-menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Tùy chọn"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <i className="fas fa-ellipsis-v" />
          </button>
          {menuOpen && (
            <div className="movie-detail-comment-dropdown">
              <button type="button" onClick={() => { onEdit(); setMenuOpen(false); }}>
                <i className="fas fa-pen" /> Sửa
              </button>
              <button type="button" onClick={() => { onDelete(); setMenuOpen(false); }}>
                <i className="fas fa-trash-alt" /> Xóa
              </button>
            </div>
          )}
        </div>
      )}
      {onReport && (
        <button
          type="button"
          className="movie-detail-comment-report"
          onClick={() => onReport(commentId)}
          disabled={reportDisabled}
          title="Báo cáo"
        >
          <i className="fas fa-flag" /> {reportDisabled ? 'Đã báo cáo' : 'Báo cáo'}
        </button>
      )}
    </div>
  );
}
