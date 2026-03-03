import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePublicSettings } from '../context/PublicSettingsContext';

/**
 * Google Analytics 4: Measurement ID lấy từ cài đặt admin (ga4_measurement_id).
 * Chỉ inject script và gửi page_view khi đã cấu hình ID trong Cài đặt.
 */
export default function GoogleAnalytics4() {
  const settings = usePublicSettings();
  const location = useLocation();
  const gaLoaded = useRef(false);

  const gaId = (settings?.ga4_measurement_id || '').trim();
  const validId = gaId && /^G-[A-Z0-9]+$/i.test(gaId);

  useEffect(() => {
    if (!validId || typeof document === 'undefined') return;
    if (gaLoaded.current) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(...args) { window.dataLayer.push(args); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', gaId, { send_page_view: false });
    gaLoaded.current = true;
  }, [validId, gaId]);

  useEffect(() => {
    if (!validId || !window.gtag) return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [validId, location.pathname, location.search]);

  return null;
}
