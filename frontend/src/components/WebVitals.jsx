import { useEffect } from 'react';
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

/**
 * Báo cáo Core Web Vitals (CWV):
 * - Development: log ra console.
 * - Production: gửi lên GA4 (event) nếu window.gtag có sẵn (GoogleAnalytics4).
 * Chạy một lần khi mount.
 */
function reportWebVitals() {
  const send = (metric) => {
    const body = JSON.stringify(metric);
    if (import.meta.env.DEV) {
      console.log('[Web Vitals]', metric.name, metric.value, metric.rating, body);
    }
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        event_category: 'Web Vitals',
        event_label: metric.id,
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        non_interaction: true,
      });
    }
  };

  onCLS(send);
  onINP(send);
  onLCP(send);
  onFCP(send);
  onTTFB(send);
}

export default function WebVitals() {
  useEffect(() => {
    reportWebVitals();
  }, []);
  return null;
}
