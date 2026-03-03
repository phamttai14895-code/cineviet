/**
 * JSON-LD structured data cho SEO (rich snippets).
 * WebSite: dùng trong Layout; name/description lấy từ Cài đặt hệ thống.
 */
import { useEffect } from 'react';
import { toTitleCase } from '../utils/titleCase.js';
import { usePublicSettings } from '../context/PublicSettingsContext';

function getBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

export function WebSiteJsonLd() {
  const settings = usePublicSettings();
  const base = getBaseUrl();
  const name = (settings?.site_name || '').trim() || 'CineViet';
  const description = (settings?.site_description || '').trim() || 'Xem phim online miễn phí, phim lẻ, phim bộ, anime. Chất lượng HD, cập nhật nhanh.';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: base + '/',
    inLanguage: 'vi',
    description,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${base}/tim-kiem?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
  return <JsonLdScript data={data} />;
}

export function MovieJsonLd({ movie, watchUrl }) {
  if (!movie) return null;
  const base = getBaseUrl();
  const imageUrl = movie.poster
    ? (movie.poster.startsWith('http') ? movie.poster : base + (movie.poster.startsWith('/') ? movie.poster : '/' + movie.poster))
    : null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: toTitleCase(movie.title),
    inLanguage: 'vi',
    ...(movie.title_en && { alternateName: toTitleCase(movie.title_en) }),
    ...(movie.description && { description: movie.description }),
    ...(imageUrl && { image: imageUrl }),
    ...(movie.release_year && { datePublished: String(movie.release_year) }),
    ...(movie.rating && { aggregateRating: { '@type': 'AggregateRating', ratingValue: movie.rating, bestRating: 5, ratingCount: 1 } }),
    ...(watchUrl && { url: watchUrl.startsWith('http') ? watchUrl : base + watchUrl }),
  };
  return <JsonLdScript data={data} />;
}

export function BreadcrumbJsonLd({ items }) {
  if (!items?.length) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.url && { item: item.url }),
    })),
  };
  return <JsonLdScript data={data} />;
}

function JsonLdScript({ data }) {
  const str = JSON.stringify(data);
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = str;
    script.id = 'jsonld-' + Math.random().toString(36).slice(2, 9);
    document.head.appendChild(script);
    return () => {
      const el = document.getElementById(script.id);
      if (el) el.remove();
    };
  }, [str]);
  return null;
}
