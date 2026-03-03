import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN;

/** GA4 dùng cài đặt admin (Cài đặt → Google Analytics 4). Plausible vẫn dùng env. */
export default function Analytics() {
  const location = useLocation();

  // Plausible (tự theo dõi SPA khi dùng pushState)
  useEffect(() => {
    if (!PLAUSIBLE_DOMAIN || typeof document === 'undefined') return;
    if (document.getElementById('plausible-script')) return;
    const s = document.createElement('script');
    s.id = 'plausible-script';
    s.defer = true;
    s.dataset.domain = PLAUSIBLE_DOMAIN;
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!PLAUSIBLE_DOMAIN || !window.plausible) return;
    window.plausible('pageview', { u: window.location.href });
  }, [location.pathname, location.search]);

  return null;
}
