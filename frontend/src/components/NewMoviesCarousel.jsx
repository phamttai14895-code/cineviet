import { useState, useEffect, useCallback, useRef } from 'react';
import MovieCard from './MovieCard';
import HoverPopupCard from './HoverPopupCard';

const NEW_MOVIES_MAX = 12;
const AUTO_PLAY_MS = 5000;
const GAP_PX = 16;
/* Hiển thị 6 card desktop, 3 tablet, 2 mobile */
const VISIBLE_DESKTOP = 6;
const VISIBLE_1024 = 3;
const VISIBLE_768 = 2;
const VISIBLE_600 = 2;

export default function NewMoviesCarousel({ items, showNewBadge = false }) {
  const list = (items || []).slice(0, NEW_MOVIES_MAX);
  const [index, setIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_DESKTOP);
  const [slideWidthPx, setSlideWidthPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pointerDown, setPointerDown] = useState(false);
  const [dragTranslatePx, setDragTranslatePx] = useState(0);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const dragStartX = useRef(0);
  const dragStartTranslate = useRef(0);
  const lastDragTranslatePx = useRef(0);
  const hasDragged = useRef(false);

  useEffect(() => {
    const mq = (w) => window.matchMedia(`(max-width: ${w}px)`);
    const update = () => {
      if (mq(600).matches) setVisibleCount(VISIBLE_600);
      else if (mq(768).matches) setVisibleCount(VISIBLE_768);
      else if (mq(1024).matches) setVisibleCount(VISIBLE_1024);
      else setVisibleCount(VISIBLE_DESKTOP);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const measureSlideWidth = useCallback(() => {
    if (!viewportRef.current) return;
    const w = viewportRef.current.offsetWidth;
    const cols = visibleCount;
    setSlideWidthPx((w - (cols - 1) * GAP_PX) / cols);
  }, [visibleCount]);

  useEffect(() => {
    measureSlideWidth();
    window.addEventListener('resize', measureSlideWidth);
    return () => window.removeEventListener('resize', measureSlideWidth);
  }, [visibleCount, measureSlideWidth]);

  const maxIndex = Math.max(0, list.length - visibleCount);
  const stepPx = slideWidthPx + GAP_PX;
  const maxTranslatePx = maxIndex * stepPx;

  const go = useCallback((delta) => {
    setIndex((i) => {
      if (list.length <= visibleCount) return 0;
      const next = i + delta;
      if (next < 0) return maxIndex;
      if (next > maxIndex) return 0;
      return next;
    });
  }, [list.length, visibleCount, maxIndex]);

  useEffect(() => {
    if (list.length <= visibleCount) return;
    const id = setInterval(() => go(1), AUTO_PLAY_MS);
    return () => clearInterval(id);
  }, [list.length, visibleCount, go]);

  const getClientX = (e) => e.clientX ?? e.touches?.[0]?.clientX;

  const handleDragStart = useCallback(
    (e) => {
      if (list.length <= visibleCount) return;
      const clientX = getClientX(e);
      if (clientX == null) return;
      if (e.button !== undefined && e.button !== 0) return;
      hasDragged.current = false;
      dragStartX.current = clientX;
      dragStartTranslate.current = index * stepPx;
      lastDragTranslatePx.current = index * stepPx;
      setDragTranslatePx(index * stepPx);
      setPointerDown(true);
    },
    [list.length, visibleCount, index, stepPx]
  );

  const handleTouchStart = useCallback(
    (e) => {
      if (list.length <= visibleCount) return;
      const clientX = e.touches?.[0]?.clientX;
      if (clientX == null) return;
      hasDragged.current = false;
      dragStartX.current = clientX;
      dragStartTranslate.current = index * stepPx;
      lastDragTranslatePx.current = index * stepPx;
      setDragTranslatePx(index * stepPx);
      setPointerDown(true);
    },
    [list.length, visibleCount, index, stepPx]
  );

  useEffect(() => {
    if (!pointerDown) return;
    const onMove = (e) => {
      const clientX = getClientX(e);
      if (clientX == null) return;
      const dx = dragStartX.current - clientX;
      if (Math.abs(dx) > 5) hasDragged.current = true;
      if (hasDragged.current) {
        setIsDragging(true);
        const next = Math.max(0, Math.min(maxTranslatePx, dragStartTranslate.current + dx));
        lastDragTranslatePx.current = next;
        setDragTranslatePx(next);
      }
    };
    const onTouchMove = (e) => {
      if (hasDragged.current) e.preventDefault();
      onMove(e);
    };
    const onEnd = () => {
      const currentPx = lastDragTranslatePx.current;
      const snapped = Math.round(currentPx / stepPx);
      setIndex(Math.max(0, Math.min(maxIndex, snapped)));
      setIsDragging(false);
      setPointerDown(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [pointerDown, maxTranslatePx, stepPx, maxIndex]);

  if (!list.length) return null;

  const translateX = isDragging ? dragTranslatePx : index * stepPx;
  const trackWidthPx = list.length * slideWidthPx + (list.length - 1) * GAP_PX;

  return (
    <div className="new-movies-carousel">
      <div
        ref={viewportRef}
        className={`new-movies-carousel-viewport ${isDragging ? 'is-dragging' : ''}`}
        style={{ '--slide-width-px': slideWidthPx > 0 ? `${slideWidthPx}px` : undefined }}
        onMouseDown={handleDragStart}
        onTouchStart={handleTouchStart}
      >
        <div
          ref={trackRef}
          className="new-movies-carousel-track"
          style={{
            width: slideWidthPx > 0 ? `${trackWidthPx}px` : undefined,
            transform: `translateX(-${translateX}px)`,
          }}
        >
          {list.map((m) => (
            <div key={m.id} className="new-movies-carousel-slide">
              <HoverPopupCard movie={m}>
                <MovieCard movie={m} showBadges showNewBadge={showNewBadge} />
              </HoverPopupCard>
            </div>
          ))}
        </div>
      </div>
      {list.length > visibleCount && (
        <>
          <button
            type="button"
            className="new-movies-carousel-arrow new-movies-carousel-prev"
            onClick={() => go(-1)}
            aria-label="Trước"
          >
            <i className="fas fa-chevron-left" />
          </button>
          <button
            type="button"
            className="new-movies-carousel-arrow new-movies-carousel-next"
            onClick={() => go(1)}
            aria-label="Sau"
          >
            <i className="fas fa-chevron-right" />
          </button>
        </>
      )}
    </div>
  );
}
