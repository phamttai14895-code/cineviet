/**
 * Core Web Vitals: gửi metric lên console (dev) và gtag (GA4) nếu có.
 * LCP < 2.5s, INP < 200ms, CLS < 0.1 là tốt. FCP, TTFB bổ sung.
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

function sendToConsole(metric) {
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating, metric);
  }
}

function sendToAnalytics(metric) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }
}

function report(metric) {
  sendToConsole(metric);
  sendToAnalytics(metric);
}

export function reportWebVitals() {
  onCLS(report);
  onFCP(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);
}
