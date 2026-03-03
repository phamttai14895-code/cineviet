import { useState, useEffect } from 'react';

const SCROLL_THRESHOLD = 400;

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      className="back-to-top-btn"
      onClick={scrollToTop}
      aria-label="Về đầu trang"
    >
      <span className="back-to-top-icon">
        <i className="fas fa-chevron-up" />
      </span>
      <span className="back-to-top-text">
        <span>ĐẦU</span>
        <span>TRANG</span>
      </span>
    </button>
  );
}
