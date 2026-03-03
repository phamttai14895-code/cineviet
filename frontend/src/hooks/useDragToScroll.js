import { useEffect, useRef } from 'react';

/**
 * Hook: kéo chuột để scroll ngang. Dùng requestAnimationFrame để cập nhật
 * scroll đúng 1 lần/frame → đồng bộ với màn hình, giảm giật.
 */
export function useDragToScroll(ref) {
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasDragged = useRef(false);
  const rafId = useRef(null);
  const lastClientX = useRef(0);

  useEffect(() => {
    const el = ref?.current;
    if (!el) return;

    el.setAttribute('data-drag-scroll', 'true');

    const applyScroll = () => {
      rafId.current = null;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const walk = lastClientX.current - startX.current;
      const nextScroll = Math.max(0, Math.min(maxScroll, scrollLeft.current - walk));
      el.scrollLeft = nextScroll;
      scrollLeft.current = nextScroll;
      startX.current = lastClientX.current;
    };

    const scheduleScroll = () => {
      if (rafId.current != null) return;
      rafId.current = requestAnimationFrame(applyScroll);
    };

    const DRAG_THRESHOLD = 5;
    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      isDown.current = true;
      hasDragged.current = false;
      startX.current = e.clientX;
      lastClientX.current = e.clientX;
      scrollLeft.current = el.scrollLeft;
    };

    const handleMouseLeave = () => {
      if (isDown.current && hasDragged.current) el.classList.add('carousel-dragging');
      isDown.current = false;
      el.style.cursor = 'grab';
      el.style.userSelect = '';
      setTimeout(() => {
        el.classList.remove('carousel-dragging');
        hasDragged.current = false;
      }, 100);
    };

    const handleMouseUp = () => {
      if (hasDragged.current) el.classList.add('carousel-dragging');
      isDown.current = false;
      el.style.cursor = 'grab';
      el.style.userSelect = '';
      setTimeout(() => {
        el.classList.remove('carousel-dragging');
        hasDragged.current = false;
      }, 100);
    };

    const handleMouseMove = (e) => {
      if (!isDown.current) return;
      const walk = e.clientX - startX.current;
      if (Math.abs(walk) > DRAG_THRESHOLD) {
        hasDragged.current = true;
        el.style.cursor = 'grabbing';
        el.style.userSelect = 'none';
        e.preventDefault();
      }
      if (hasDragged.current) {
        lastClientX.current = e.clientX;
        scheduleScroll();
      }
    };

    const handleTouchStart = (e) => {
      startX.current = e.touches[0].clientX;
      lastClientX.current = e.touches[0].clientX;
      scrollLeft.current = el.scrollLeft;
      hasDragged.current = false;
    };

    const handleTouchMove = (e) => {
      if (!hasDragged.current) {
        const dx = e.touches[0].clientX - startX.current;
        if (Math.abs(dx) > DRAG_THRESHOLD) hasDragged.current = true;
      }
      if (hasDragged.current) {
        e.preventDefault();
        lastClientX.current = e.touches[0].clientX;
        scheduleScroll();
      }
    };

    el.style.cursor = 'grab';
    el.addEventListener('mousedown', handleMouseDown, { capture: true });
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mousemove', handleMouseMove, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      el.removeEventListener('mousedown', handleMouseDown, { capture: true });
      el.removeAttribute('data-drag-scroll');
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [ref]);
}
