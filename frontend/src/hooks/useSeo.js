import { useEffect } from 'react';
import { usePublicSettings } from '../context/PublicSettingsContext';

const FALLBACK_TITLE = 'CineViet - Xem phim trực tuyến chất lượng cao, cập nhật nhanh';
const FALLBACK_DESCRIPTION = 'Xem phim online miễn phí, phim lẻ, phim bộ, anime mới nhất. Chất lượng HD, cập nhật nhanh, giao diện thân thiện.';

function setMeta(nameOrProp, content, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${nameOrProp}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, nameOrProp);
    document.head.appendChild(el);
  }
  if (el.getAttribute('content') !== content) el.setAttribute('content', content);
}

/**
 * Cập nhật title, meta description, Open Graph và Twitter Card cho SEO.
 * Dùng site_name và site_description từ Cài đặt hệ thống (Admin) khi có.
 * @param {string} title - Tiêu đề trang
 * @param {string} [description] - Meta description (mặc định lấy từ cài đặt hoặc FALLBACK_DESCRIPTION)
 * @param {string} [image] - URL ảnh cho og:image / twitter:image
 */
export function useSeo(title, description, image) {
  const settings = usePublicSettings();
  const siteName = (settings?.site_name || '').trim() || 'CineViet';
  const siteDescription = (settings?.site_description || '').trim() || FALLBACK_DESCRIPTION;
  const defaultTitle = siteName + ' - Xem phim trực tuyến chất lượng cao, cập nhật nhanh';
  const defaultDesc = siteDescription;

  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const prevOgImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

    const raw = title && title.trim() ? title.trim() : '';
    const t = raw && !raw.endsWith(siteName) ? `${raw} | ${siteName}` : (raw || defaultTitle);
    const d = description && description.trim() ? description.trim() : defaultDesc;

    document.title = t;
    setMeta('description', d);
    setMeta('og:title', t, true);
    setMeta('og:description', d, true);
    setMeta('og:type', raw ? 'article' : 'website', true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', t);
    setMeta('twitter:description', d);

    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
    const fullUrl = origin
      ? (window.location.pathname === '/' ? origin + '/' : window.location.href.split('?')[0])
      : '';
    if (fullUrl) {
      const canonical = document.getElementById('canonical-link');
      if (canonical && canonical.getAttribute('href') !== fullUrl) canonical.setAttribute('href', fullUrl);
      setMeta('og:url', fullUrl, true);
    }

    const imageUrl = image && image.trim() ? (image.startsWith('http') ? image : origin + (image.startsWith('/') ? '' : '/') + image) : '';
    if (imageUrl) {
      setMeta('og:image', imageUrl, true);
      setMeta('twitter:image', imageUrl);
    }

    return () => {
      document.title = prevTitle || defaultTitle;
      if (prevDesc) setMeta('description', prevDesc);
      setMeta('og:title', defaultTitle, true);
      setMeta('og:description', defaultDesc, true);
      setMeta('og:type', 'website', true);
      setMeta('og:image', prevOgImage || '', true);
      setMeta('twitter:title', defaultTitle);
      setMeta('twitter:description', defaultDesc);
      if (imageUrl) setMeta('twitter:image', '');
    };
  }, [title, description, image, siteName, siteDescription, defaultTitle, defaultDesc]);
}

export const DEFAULT_TITLE = FALLBACK_TITLE;
export const DEFAULT_DESCRIPTION = FALLBACK_DESCRIPTION;
