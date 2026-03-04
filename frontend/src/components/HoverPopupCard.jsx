import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../utils/imageUrl.js';
import { toTitleCase } from '../utils/titleCase.js';
import { useAuth } from '../context/AuthContext';
import { user as userApi } from '../api/client';

const POSTER_PLACEHOLDER = NO_POSTER_DATA_URL;

function isDirectVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase().split('?')[0];
  return /\.(mp4|m3u8|webm|ogg|mov)(\?|$)/i.test(u);
}

/** Chuyển URL YouTube/Vimeo sang embed: tự phát, ẩn thanh điều khiển, ít logo. */
function toEmbedUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const u = url.trim();
  const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) {
    const id = ytMatch[1];
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0&enablejsapi=1`;
  }
  const vimeoMatch = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1`;
  if (u.includes('youtube.com/embed/') || u.includes('player.vimeo.com/')) {
    const sep = u.includes('?') ? '&' : '?';
    return `${u}${sep}autoplay=1&mute=1&controls=0&modestbranding=1`;
  }
  return u;
}

/** Nhãn tập cho phim bộ / anime. */
function getEpisodeLabel(movie) {
  if (!movie) return null;
  const isSeries = movie.type === 'series' || movie.type === 'anime' || movie.type === 'tvshows';
  if (!isSeries) return null;
  const total = movie.total_episodes != null ? Math.max(0, parseInt(movie.total_episodes, 10) || 0) : 0;
  const raw = movie.episode_current;
  if (typeof raw === 'string' && /hoàn\s*tất/i.test((raw || '').trim())) return { episode: 'Hoàn Tất', part: null };
  const current = raw != null ? Math.max(0, parseInt(raw, 10) || 0) : null;
  const part = movie.parts?.length > 1 ? movie.parts.find((p) => p.id === movie.id)?.part_number : null;
  const episode = current != null && total > 0 && current >= total ? 'Hoàn Tất' : current != null && current > 0 ? `Tập ${current}` : total > 0 ? `Tập ${total}` : null;
  return { episode, part: part != null ? `Phần ${part}` : null };
}

export default function HoverPopupCard({ movie, children, className = '' }) {
  const [visible, setVisible] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [trailerMuted, setTrailerMuted] = useState(true);
  const [trailerError, setTrailerError] = useState(false);
  const timeoutRef = useRef(null);
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const trailerLoadingTimeoutRef = useRef(null);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  /** Vị trí popup: set 1 lần khi mở (đúng vị trí card hover); không cập nhật khi cuộn; khi scroll/wheel thì popup tự tắt */
  const frozenPositionRef = useRef({ left: 0, top: 0 });
  const popupAlreadyOpenRef = useRef(false);
  const { user, openLoginModal } = useAuth();

  const POPUP_WIDTH = 520;
  const POPUP_HEIGHT_EST = 560;

  /** Tính vị trí popup từ card (không dùng event chuột). */
  const getPopupPosition = useCallback(() => {
    if (!wrapRef.current || typeof window === 'undefined') return frozenPositionRef.current;
    const el = wrapRef.current.firstElementChild || wrapRef.current;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const margin = 12;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const left = Math.max(POPUP_WIDTH / 2 + margin, Math.min(centerX, w - POPUP_WIDTH / 2 - margin));
    const top = Math.max(POPUP_HEIGHT_EST / 2 + margin, Math.min(centerY, h - POPUP_HEIGHT_EST / 2 - margin));
    return { left, top };
  }, []);

  const backdrop = imageDisplayUrl(movie?.backdrop || movie?.poster) || POSTER_PLACEHOLDER;
  const hasTrailer = (movie?.trailer_url || '').trim().length > 0;
  const directVideo = hasTrailer && isDirectVideoUrl(movie.trailer_url);
  const embedUrl = hasTrailer && !directVideo ? toEmbedUrl(movie.trailer_url) : '';
  const episodeInfo = getEpisodeLabel(movie);
  const genres = movie?.genres?.length ? movie.genres.join(' • ') : '';

  useEffect(() => {
    if (!user || !movie?.id || !visible) return;
    userApi.favoriteIds().then((r) => setFavorited((r.data || []).includes(movie.id))).catch(() => {});
  }, [user, movie?.id, visible]);

  useEffect(() => {
    if (!visible || !hasTrailer) {
      setTrailerMuted(true);
      setTrailerError(false);
      ytPlayerRef.current = null;
      ytRetryCountRef.current = 0;
      if (trailerLoadingTimeoutRef.current) {
        clearTimeout(trailerLoadingTimeoutRef.current);
        trailerLoadingTimeoutRef.current = null;
      }
    }
  }, [visible, hasTrailer]);

  useEffect(() => {
    if (!visible || !hasTrailer || directVideo || trailerError) return;
    trailerLoadingTimeoutRef.current = setTimeout(() => setTrailerError(true), 6000);
    return () => {
      if (trailerLoadingTimeoutRef.current) {
        clearTimeout(trailerLoadingTimeoutRef.current);
        trailerLoadingTimeoutRef.current = null;
      }
    };
  }, [visible, hasTrailer, directVideo, trailerError]);

  /** Chỉ ghi vị trí đã lưu (frozenPositionRef) lên DOM — không đọc lại card, không cập nhật khi cuộn */
  const pinPopupPositionToDom = useCallback(() => {
    if (!popupRef.current) return;
    const p = frozenPositionRef.current;
    popupRef.current.style.setProperty('left', `${p.left}px`, 'important');
    popupRef.current.style.setProperty('top', `${p.top}px`, 'important');
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    pinPopupPositionToDom();
  });

  /** Khi cuộn (wheel hoặc scroll) thì tự tắt popup — popup không di chuyển theo */
  const closePopupRef = useRef(null);
  closePopupRef.current = () => {
    popupAlreadyOpenRef.current = false;
    setVisible(false);
  };
  useEffect(() => {
    if (!visible) return;
    const win = typeof window !== 'undefined' ? window : null;
    if (!win) return;
    const onScrollOrWheel = () => closePopupRef.current?.();
    win.addEventListener('wheel', onScrollOrWheel, { capture: true, passive: true });
    win.addEventListener('scroll', onScrollOrWheel, { capture: true });
    return () => {
      win.removeEventListener('wheel', onScrollOrWheel, { capture: true });
      win.removeEventListener('scroll', onScrollOrWheel, { capture: true });
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !embedUrl || !embedUrl.includes('youtube.com')) return;
    if (window.YT && window.YT.Player) return;
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  }, [visible, embedUrl]);

  const ytRetryCountRef = useRef(0);
  const tryCreateYtPlayerWithErrorHandler = useCallback(() => {
    if (!iframeRef.current || !embedUrl?.includes('youtube.com') || ytPlayerRef.current) return;
    if (window.YT && window.YT.Player) {
      try {
        const YT = window.YT;
        ytPlayerRef.current = new YT.Player(iframeRef.current, {
          events: {
            onError: () => setTrailerError(true),
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING && trailerLoadingTimeoutRef.current) {
                clearTimeout(trailerLoadingTimeoutRef.current);
                trailerLoadingTimeoutRef.current = null;
              }
            },
          },
        });
      } catch (_) {}
      return;
    }
    ytRetryCountRef.current += 1;
    if (ytRetryCountRef.current < 25) {
      setTimeout(tryCreateYtPlayerWithErrorHandler, 300);
    }
  }, [embedUrl]);

  const handleTrailerMuteToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !trailerMuted;
    if (directVideo && videoRef.current) {
      videoRef.current.muted = next;
      setTrailerMuted(next);
    } else if (embedUrl && iframeRef.current) {
      if (window.YT && window.YT.Player) {
        try {
          if (!ytPlayerRef.current) ytPlayerRef.current = new window.YT.Player(iframeRef.current);
          const player = ytPlayerRef.current;
          if (player.mute) {
            if (next) player.mute();
            else player.unMute();
            setTrailerMuted(next);
          }
        } catch (_) {}
      } else if (trailerMuted && !next && movie?.trailer_url) {
        window.open(movie.trailer_url, '_blank', 'noopener');
      }
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (popupAlreadyOpenRef.current) return;
      const pos = getPopupPosition();
      frozenPositionRef.current = { left: pos.left, top: pos.top };
      popupAlreadyOpenRef.current = true;
      setVisible(true);
    }, 180);
  };

  const handleMouseLeave = (e) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const to = e?.relatedTarget;
    if (to && typeof Node !== 'undefined' && to instanceof Node && popupRef.current && popupRef.current.contains(to)) return;
    popupAlreadyOpenRef.current = false;
    setVisible(false);
  };

  const handlePopupMouseLeave = (e) => {
    const to = e?.relatedTarget;
    if (to && typeof Node !== 'undefined' && to instanceof Node && wrapRef.current && wrapRef.current.contains(to)) return;
    popupAlreadyOpenRef.current = false;
    setVisible(false);
  };

  const handleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      openLoginModal();
      return;
    }
    userApi.favorite(movie.id).then(() => setFavorited((v) => !v)).catch(() => {});
  };

  const popupContent = visible && movie && (
    <div
      ref={(el) => {
        popupRef.current = el;
        if (el) {
          const p = frozenPositionRef.current;
          el.style.setProperty('left', `${p.left}px`, 'important');
          el.style.setProperty('top', `${p.top}px`, 'important');
        }
      }}
      className="hover-popup-card-popup hover-popup-card-popup-portal"
      role="dialog"
      aria-label="Thông tin nhanh"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onMouseLeave={handlePopupMouseLeave}
    >
          <div className="hover-popup-card-banner">
            {hasTrailer && !trailerError ? (
              directVideo ? (
                <video
                  ref={videoRef}
                  src={movie.trailer_url}
                  className="hover-popup-card-banner-media"
                  muted
                  autoPlay
                  loop
                  playsInline
                  draggable={false}
                  onError={() => setTrailerError(true)}
                />
              ) : (
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  className="hover-popup-card-banner-media"
                  title={movie.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onError={() => setTrailerError(true)}
                  onLoad={() => {
                    tryCreateYtPlayerWithErrorHandler();
                  }}
                />
              )
            ) : (
              <img src={backdrop} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} />
            )}
            {hasTrailer && !trailerError && (
              <>
                <div className="hover-popup-card-banner-block" aria-hidden />
                <button
                  type="button"
                  className="hover-popup-card-banner-mute"
                  onClick={handleTrailerMuteToggle}
                  aria-label={trailerMuted ? 'Bật tiếng' : 'Tắt tiếng'}
                  title={trailerMuted ? 'Bật tiếng' : 'Tắt tiếng'}
                >
                  <i className={trailerMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up'} />
                </button>
              </>
            )}
            {!hasTrailer && (
              <div className="hover-popup-card-banner-title">{toTitleCase(movie.title)}</div>
            )}
          </div>
          <div className="hover-popup-card-info">
            <h3 className="hover-popup-card-title">{toTitleCase(movie.title)}</h3>
            {movie.title_en && <p className="hover-popup-card-subtitle">{toTitleCase(movie.title_en)}</p>}
            <div className="hover-popup-card-actions">
              <Link to={`/movie/${movie.id}`} className="hover-popup-card-btn hover-popup-card-btn-primary" onClick={(e) => e.stopPropagation()}>
                <i className="fas fa-play" /> Xem ngay
              </Link>
              <button type="button" className="hover-popup-card-btn hover-popup-card-btn-ghost" onClick={handleFavorite} aria-label="Thích">
                <i className={favorited ? 'fas fa-heart' : 'far fa-heart'} /> Thích
              </button>
            </div>
            <div className="hover-popup-card-meta">
              {movie.release_year && <span className="hover-popup-card-tag">{movie.release_year}</span>}
              {episodeInfo?.part && <span className="hover-popup-card-tag">{episodeInfo.part}</span>}
              {episodeInfo?.episode && <span className="hover-popup-card-tag">{episodeInfo.episode}</span>}
              {genres && <span className="hover-popup-card-genres">{genres}</span>}
            </div>
          </div>
        </div>
  );

  return (
    <div
      ref={wrapRef}
      className={`hover-popup-card-wrap ${className}`.trim()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {typeof document !== 'undefined' && popupContent
        ? createPortal(popupContent, document.body)
        : null}
    </div>
  );
}
