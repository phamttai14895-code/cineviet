import { useRef } from 'react';
import { useDragToScroll } from '../hooks/useDragToScroll';

/**
 * Wrapper: div scroll ngang + kéo chuột được, scrollbar ẩn.
 * Dùng cho .movie-row trên Home.
 */
export default function DragScroll({ className, children, ...props }) {
  const ref = useRef(null);
  useDragToScroll(ref);
  return (
    <div ref={ref} className={`drag-scroll ${className || ''}`.trim()} {...props}>
      {children}
    </div>
  );
}
