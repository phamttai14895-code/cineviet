import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { movies as moviesApi, user as userApi } from '../api/client';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../utils/imageUrl.js';
import { toTitleCase } from '../utils/titleCase.js';

const INTERVAL_MS = 6000;
const PLACEHOLDER_BG = NO_POSTER_DATA_URL;
const FEATURED_MAX = 10;
const DESC_MAX_LENGTH = 220;

/** Backdrop cho nền full màn hình (ưu tiên backdrop, fallback poster). */
function getBackdropUrl(movie) {
  if (!movie) return null;
  return movie.backdrop || movie.poster || movie.thumbnail;
}

/** Poster cho thẻ bên phải — luôn dùng poster (poster_url từ nguồn), fallback thumbnail/backdrop. */
function getFeaturedPosterUrl(movie) {
  if (!movie) return null;
  return movie.poster_url || movie.poster || movie.thumbnail || movie.backdrop;
}

/** Ảnh dùng chung (thumbnail/poster) cho các chỗ khác nếu cần. */
function getFeaturedImage(movie) {
  if (!movie) return null;
  if (movie.source === 'ophim') return movie.poster || movie.thumbnail || movie.backdrop;
  return movie.thumbnail || movie.poster || movie.backdrop;
}

function formatDuration(mins) {
  if (!mins || mins < 1) return null;
  const m = Math.round(mins);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}p` : `${m} phút`;
}

/** Loại bỏ thẻ HTML và trả về text thuần để hiển thị mô tả */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

export default function FeaturedCarousel({ items }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const viewportRef = useRef(null);
  const slideRefs = useRef([]);
  const dragStartRef = useRef(null);
  const justDraggedRef = useRef(false);
  const listItems = items.slice(0, FEATURED_MAX);
  const total = listItems.length;

  const go = useCallback((next) => {
    setIndex((i) => (total <= 1 ? 0 : (i + next + total) % total));
  }, [total]);

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => go(1), INTERVAL_MS);
    return () => clearInterval(id);
  }, [total, go]);

  useEffect(() => {
    if (!user) return;
    userApi.favoriteIds().then((r) => setFavoriteIds(new Set(r.data || []))).catch(() => {});
  }, [user]);

  /* Mobile: viewport cao bằng đúng slide đang hiện → hết khoảng đen */
  useEffect(() => {
    const viewport = viewportRef.current;
    const slideEl = slideRefs.current[index];
    if (!viewport || !slideEl) return;
    const setHeight = () => {
      if (!window.matchMedia('(max-width: 640px)').matches) return;
      const h = slideEl.offsetHeight;
      if (h > 0) viewport.style.height = `${h}px`;
    };
    setHeight();
    const ro = new ResizeObserver(setHeight);
    ro.observe(slideEl);
    return () => ro.disconnect();
  }, [index, listItems.length]);

  /* Kéo viewport trái/phải để đổi slide — chỉ coi là drag khi di chuyển > 10px, còn lại vẫn cho click */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || total <= 1) return;
    const DRAG_THRESHOLD = 10;
    const SWIPE_MIN = 40;
    const onDown = (e) => {
      if (e.target.closest('a, button')) return;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e) => {
      const start = dragStartRef.current;
      if (!start) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) start.dragging = true;
    };
    const onUp = (e) => {
      const start = dragStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      if (start.dragging && Math.abs(dx) > SWIPE_MIN) {
        justDraggedRef.current = true;
        go(dx > 0 ? -1 : 1);
      }
      dragStartRef.current = null;
    };
    const onCaptureClick = (e) => {
      if (justDraggedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        justDraggedRef.current = false;
      }
    };
    viewport.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    viewport.addEventListener('click', onCaptureClick, true);
    return () => {
      viewport.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      viewport.removeEventListener('click', onCaptureClick, true);
    };
  }, [total, go]);

  const toggleFavorite = (e, movieId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    moviesApi.favorite(movieId).then(() => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(movieId)) next.delete(movieId);
        else next.add(movieId);
        return next;
      });
    }).catch(() => {});
  };

  if (!listItems.length) return null;

  return (
    <>
      <section className="featured-hero" aria-label="Phim nổi bật">
        <div className="featured-hero-inner">
        <div className="featured-hero-viewport" ref={viewportRef}>
          <div className="featured-hero-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {listItems.map((m, i) => (
              <div
                key={m.id}
                className="featured-hero-slide"
                ref={(el) => { slideRefs.current[i] = el; }}
                onClick={(e) => {
                  if (e.target.closest('.featured-hero-content')) return;
                  if (justDraggedRef.current) { justDraggedRef.current = false; return; }
                  navigate(`/movie/${m.id}`);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.target.closest('.featured-hero-content')) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/movie/${m.id}`);
                  }
                }}
                aria-label={`Xem phim ${toTitleCase(m.title)}`}
              >
                {/* Mobile: hiện poster (poster_url); desktop dùng .featured-hero-bg (backdrop) */}
                <img
                  className="featured-hero-img"
                  src={imageDisplayUrl(getFeaturedPosterUrl(m)) || PLACEHOLDER_BG}
                  alt=""
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
                <div
                  className="featured-hero-bg"
                  style={{ backgroundImage: `url(${imageDisplayUrl(getBackdropUrl(m)) || PLACEHOLDER_BG})` }}
                  aria-hidden
                />
                <div className="featured-hero-overlay" />
                <div className="featured-hero-overlay-bottom" aria-hidden />
                <div className="featured-hero-content container">
                  <div className="featured-hero-left">
                    <div className="featured-hero-badges">
                      <span className="featured-hero-badge featured-hero-badge-main">
                        <i className="fas fa-film" aria-hidden /> Phim nổi bật
                      </span>
                      {m.release_year && <span className="featured-hero-badge featured-hero-badge-year">{m.release_year}</span>}
                      {m.rating != null && Number(m.rating) > 0 && (
                        <span className="featured-hero-badge featured-hero-badge-rating">
                          <i className="fas fa-star" aria-hidden /> {Number(m.rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                    <h2 className="featured-hero-title">{toTitleCase(m.title)}</h2>
                    {m.title_en && <p className="featured-hero-subtitle featured-hero-subtitle-accent">{toTitleCase(m.title_en)}</p>}
                    <div className="featured-hero-meta">
                      {formatDuration(m.duration) && (
                        <span><i className="fas fa-clock" aria-hidden /> {formatDuration(m.duration)}{(m.type === 'series' || m.type === 'anime') && (m.total_episodes || 0) > 1 ? '/tập' : ''}</span>
                      )}
                      {typeof m.view_count === 'number' && m.view_count >= 0 && (
                        <span><i className="fas fa-eye" aria-hidden /> {m.view_count} lượt xem</span>
                      )}
                      {(m.total_episodes || m.episode_current) != null && (
                        <span className="featured-hero-meta-episode">Tập {m.episode_current != null ? m.episode_current : 0}/{m.total_episodes != null ? m.total_episodes : '?'}</span>
                      )}
                      {/* Chỉ hiện "Phần X" khi phim có nhiều phần (parts từ API hoặc part_number > 1) */}
                      {((m.parts && m.parts.length > 1) || (m.part_number != null && Number(m.part_number) > 1)) && (
                        <span className="featured-hero-meta-episode">Phần {m.parts?.find((p) => p.id === m.id)?.part_number ?? m.part_number ?? 1}</span>
                      )}
                    </div>
                    {m.genres?.length > 0 && (
                      <div className="featured-hero-genres">
                        {m.genres.slice(0, 4).map((g) => (
                          <span key={typeof g === 'object' && g && ('id' in g || 'name' in g) ? (g.id ?? g.name) : g} className="featured-hero-genre">
                            {typeof g === 'object' && g && 'name' in g ? g.name : String(g)}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.description && (() => {
                      const plain = stripHtml(m.description);
                      if (!plain) return null;
                      const show = plain.length > DESC_MAX_LENGTH ? `${plain.slice(0, DESC_MAX_LENGTH)}…` : plain;
                      return (
                        <p className="featured-hero-desc">
                          {show}
                        </p>
                      );
                    })()}
                    <div className="featured-hero-btns">
                      <Link to={`/movie/${m.id}`} className="featured-hero-btn featured-hero-btn-play" aria-label="Xem phim">
                        <i className="fas fa-play" aria-hidden /> Xem Ngay
                      </Link>
                    </div>
                  </div>
                  {/* Poster phim hiện tại — lớn, bên phải, FHD badge; dùng poster_url/poster */}
                  <div className="featured-hero-poster-wrap" onClick={(e) => e.stopPropagation()}>
                    <div className="featured-hero-right-card featured-hero-poster">
                      <span className="featured-hero-right-card-fhd">FHD</span>
                      <img src={imageDisplayUrl(getFeaturedPosterUrl(m)) || PLACEHOLDER_BG} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {total > 1 && (
            <div className="featured-hero-dots-row">
              <button
                type="button"
                className="featured-hero-dots-arrow featured-hero-dots-arrow-prev"
                onClick={() => go(-1)}
                aria-label="Slide trước"
              >
                <i className="fas fa-chevron-left" aria-hidden />
              </button>
              <div className="featured-hero-dots">
                {listItems.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`featured-hero-dot ${i === index ? 'active' : ''}`}
                    onClick={() => setIndex(i)}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                className="featured-hero-dots-arrow featured-hero-dots-arrow-next"
                onClick={() => go(1)}
                aria-label="Slide sau"
              >
                <i className="fas fa-chevron-right" aria-hidden />
              </button>
            </div>
          )}
        </div>
        </div>
      </section>
    </>
  );
}
