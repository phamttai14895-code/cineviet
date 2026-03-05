import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { movies as moviesApi } from '../api/client';
import MovieCard from '../components/MovieCard';
import { imageDisplayUrl } from '../utils/imageUrl';

const FIREWORKS_COUNT = 24;

export default function XemGiHomNay() {
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const flipTriggered = useRef(false);

  const handlePick = () => {
    setLoading(true);
    setMovie(null);
    setReveal(false);
    setFlipped(false);
    flipTriggered.current = false;
    moviesApi
      .random({})
      .then((res) => {
        const m = res.data?.movie ?? null;
        setMovie(m);
        if (m) setReveal(true);
      })
      .catch(() => setMovie(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!reveal || !movie || flipTriggered.current) return;
    flipTriggered.current = true;
    const t = setTimeout(() => setFlipped(true), 400);
    return () => clearTimeout(t);
  }, [reveal, movie]);

  const closeReveal = () => setReveal(false);

  const revealOverlay = reveal && movie && (
    <div
      className="xem-gi-reveal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Phim được chọn"
      onClick={(e) => e.target === e.currentTarget && closeReveal()}
    >
      <button
        type="button"
        className="xem-gi-reveal-close"
        onClick={closeReveal}
        aria-label="Đóng"
      >
        <i className="fas fa-times" />
      </button>
      <div className="xem-gi-reveal-fireworks" aria-hidden>
        {Array.from({ length: FIREWORKS_COUNT }, (_, i) => (
          <div
            key={i}
            className={`xem-gi-firework-dot ${i % 2 === 0 ? 'xem-gi-firework-dot--gold' : ''}`}
            style={{
              '--i': i,
              '--angle': (360 / FIREWORKS_COUNT) * i,
            }}
          />
        ))}
      </div>

      <div className="xem-gi-reveal-center">
        <div className={`xem-gi-flip-card ${flipped ? 'xem-gi-flip-card--flipped' : ''}`}>
          <div className="xem-gi-flip-card-inner">
            <div className="xem-gi-flip-card-back">
              <div className="xem-gi-card-back-pattern" />
              <span className="xem-gi-card-back-icon"><i className="fas fa-film" /></span>
              <span className="xem-gi-card-back-text">?</span>
            </div>
            <div className="xem-gi-flip-card-front xem-gi-sparkle-wrap">
              <div className="xem-gi-reveal-movie-wrap">
                <MovieCard movie={movie} showBadges />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-xem-gi-hom-nay">
      <div className="container">
        <section className="xem-gi-hero">
          <h1 className="xem-gi-title">Tui pick, bạn chill 😌</h1>
          <p className="xem-gi-subtitle">
            Để chúng tôi chọn ngẫu nhiên một bộ phim cho bạn.
          </p>

          <div
            className="xem-gi-cta-wrap"
            onMouseEnter={(e) => e.currentTarget.setAttribute('data-hover', 'true')}
            onMouseLeave={(e) => e.currentTarget.removeAttribute('data-hover')}
          >
            <button
              type="button"
              className="xem-gi-cta-btn"
              onClick={handlePick}
              disabled={loading}
              aria-describedby="xem-gi-hint"
            >
              {loading ? (
                <>
                  <span className="xem-gi-spinner" aria-hidden />
                  <span>Đang chọn...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-dice" aria-hidden />
                  <span>Chọn phim cho tôi</span>
                </>
              )}
            </button>
            <p id="xem-gi-hint" className="xem-gi-cta-hint" role="tooltip">
              Nếu bạn không biết xem gì, hãy để chúng tôi chọn giúp bạn.
            </p>
          </div>
        </section>

        {movie && !reveal && (
          <section className="xem-gi-result">
            <div
              className="xem-gi-result-bg"
              style={{ backgroundImage: `url(${imageDisplayUrl(movie.backdrop || movie.poster) || ''})` }}
              aria-hidden
            />
            <div className="xem-gi-result-content">
              <h2 className="xem-gi-result-heading">Phim của bạn hôm nay</h2>
              <div className="xem-gi-result-card-wrap">
                <MovieCard movie={movie} showBadges />
              </div>
            </div>
          </section>
        )}
      </div>

      {typeof document !== 'undefined' && revealOverlay && createPortal(revealOverlay, document.body)}
    </div>
  );
}
