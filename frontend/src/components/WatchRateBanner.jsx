import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { movies as moviesApi } from '../api/client';
import { imageDisplayUrl } from '../utils/imageUrl.js';
import { toTitleCase } from '../utils/titleCase.js';

const RATING_LABELS = {
  1: 'Rất tệ',
  2: 'Tệ',
  3: 'Trung bình',
  4: 'Tốt',
  5: 'Xuất sắc',
};

/**
 * Banner đánh giá phim trượt từ dưới lên khi bấm "Đánh giá phim" trên trang xem.
 * Hiển thị: thông tin phim, biểu đồ phân bố đánh giá, chọn sao, nút Hủy / Đánh giá.
 */
export default function WatchRateBanner({ movie, onClose, onRated, userRating: initialUserRating = 0 }) {
  const { user, openLoginModal } = useAuth();
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(initialUserRating || 0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!movie?.id) return;
    setLoading(true);
    moviesApi
      .ratingStats(movie.id)
      .then((r) => {
        const d = r.data || {};
        setStats({
          distribution: Array.isArray(d.distribution) ? d.distribution : [0, 0, 0, 0, 0],
          total: d.total ?? 0,
          average: d.average ?? 0,
          view_count: d.view_count ?? 0,
          userRating: d.userRating ?? 0,
        });
        if (d.userRating != null && d.userRating > 0) setSelectedRating(d.userRating);
      })
      .catch(() => setStats({ distribution: [0, 0, 0, 0, 0], total: 0, average: 0, view_count: 0, userRating: 0 }))
      .finally(() => setLoading(false));
  }, [movie?.id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => typeof onClose === 'function' && onClose(), 350);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleSubmit = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (selectedRating < 1 || selectedRating > 5 || !movie?.id) return;
    setSubmitting(true);
    try {
      const { data } = await moviesApi.rate(movie.id, selectedRating);
      typeof onRated === 'function' && onRated(selectedRating, data?.rating);
      handleClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || selectedRating;
  const poster = movie ? imageDisplayUrl(movie.poster) || '' : '';
  const maxCount = stats ? Math.max(1, ...(stats.distribution || [])) : 1;

  const content = (
    <div
      className={`watch-rate-banner ${visible ? 'watch-rate-banner-visible' : ''}`}
      role="dialog"
      aria-label="Đánh giá phim"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
        }
      }}
    >
      <div className="watch-rate-banner-backdrop" onClick={handleBackdropClick} aria-hidden="true" />
      <div className="watch-rate-banner-inner" onClick={(e) => e.stopPropagation()}>
        <h2 className="watch-rate-banner-title">
          <i className="fas fa-star watch-rate-banner-title-icon" aria-hidden /> Đánh giá phim
        </h2>

        <div className="watch-rate-banner-movie">
          <div className="watch-rate-banner-poster-wrap">
            <img src={poster} alt="" className="watch-rate-banner-poster" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <div className="watch-rate-banner-movie-info">
            <h3 className="watch-rate-banner-movie-title">{movie ? toTitleCase(movie.title) : ''}</h3>
            {loading ? (
              <p className="watch-rate-banner-meta"><span className="watch-rate-banner-skeleton">—</span></p>
            ) : stats ? (
              <p className="watch-rate-banner-meta">
                <span className="watch-rate-banner-avg"><i className="fas fa-star" /> {(Number(stats.average)).toFixed(1)}/5</span>
                <span>{stats.total} đánh giá</span>
                <span>{stats.view_count} lượt xem</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="watch-rate-banner-body">
          {loading ? (
            <div className="watch-rate-banner-chart watch-rate-banner-skeleton-block" />
          ) : (
            <div className="watch-rate-banner-chart" aria-label="Phân bố đánh giá">
              {[1, 2, 3, 4, 5].map((r) => {
                const count = stats?.distribution?.[r - 1] ?? 0;
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={r} className="watch-rate-banner-chart-row">
                    <span className="watch-rate-banner-chart-num">{r}</span>
                    <div className="watch-rate-banner-chart-bar-wrap">
                      <div className="watch-rate-banner-chart-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="watch-rate-banner-chart-count">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="watch-rate-banner-input">
            <div className="watch-rate-banner-value-wrap">
              <span className="watch-rate-banner-value-circle" aria-live="polite">
                <span className="watch-rate-banner-value-num">{displayRating > 0 ? displayRating : '—'}</span>
                <span className="watch-rate-banner-value-label">{displayRating > 0 ? RATING_LABELS[displayRating] : 'Chọn sao'}</span>
              </span>
            </div>
            <div className="watch-rate-banner-stars" role="group" aria-label="Chọn số sao">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`watch-rate-banner-star ${(hoverRating || selectedRating) >= r ? 'on' : ''}`}
                  onMouseEnter={() => setHoverRating(r)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setSelectedRating(r)}
                  aria-label={`${r} sao`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="watch-rate-banner-actions">
          <button type="button" className="watch-rate-banner-btn watch-rate-banner-btn-cancel" onClick={handleClose}>
            Hủy
          </button>
          <button
            type="button"
            className="watch-rate-banner-btn watch-rate-banner-btn-submit"
            onClick={handleSubmit}
            disabled={selectedRating < 1 || submitting}
          >
            Đánh giá
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
