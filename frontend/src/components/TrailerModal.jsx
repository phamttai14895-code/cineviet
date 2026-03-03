import { useEffect } from 'react';

function isDirectVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase().split('?')[0];
  return /\.(mp4|m3u8|webm|ogg|mov)(\?|$)/i.test(u);
}

/** Chuyển URL YouTube watch sang embed (hoặc trả về URL embed sẵn). */
function toEmbedUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const u = url.trim();
  const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  const vimeoMatch = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  if (u.includes('youtube.com/embed/') || u.includes('player.vimeo.com/')) return u.includes('?') ? `${u}&autoplay=1` : `${u}?autoplay=1`;
  return u;
}

export default function TrailerModal({ isOpen, onClose, trailerUrl, title = 'Trailer' }) {
  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const direct = isDirectVideoUrl(trailerUrl);
  const embedUrl = direct ? trailerUrl : toEmbedUrl(trailerUrl);

  return (
    <div
      className="trailer-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="trailer-modal">
        <button
          type="button"
          className="trailer-modal-close"
          onClick={onClose}
          aria-label="Đóng"
        >
          <i className="fas fa-times" />
        </button>
        <div className="trailer-modal-body">
          {direct ? (
            <video
              src={embedUrl}
              controls
              autoPlay
              className="trailer-modal-video"
              title={title}
            />
          ) : (
            <iframe
              src={embedUrl}
              title={title}
              className="trailer-modal-iframe"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </div>
  );
}
