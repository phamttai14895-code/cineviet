/**
 * Placeholder khi không có poster — dùng data URL để không phụ thuộc DNS/network bên ngoài.
 */
export const NO_POSTER_DATA_URL = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect fill="#1a2130" width="300" height="450"/><text x="150" y="230" fill="#7a8a9e" font-family="sans-serif" font-size="14" text-anchor="middle">No Poster</text></svg>'
);

const PROXY_HOSTS = [
  'img.ophim.live',
  'img.ophim.cc',
  'ophim.live',
  'ophim1.com',
  'ophim.cc',
  'phimapi.com',
  'img.phimapi.com',
  'phim.nguonc.com',
];

export function imageDisplayUrl(url) {
  if (!url || typeof url !== 'string') return url || '';
  const u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) return u;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    const useProxy = PROXY_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    if (useProxy) return `/api/image?url=${encodeURIComponent(u)}`;
    return u; // TMDB và nguồn khác: dùng URL gốc
  } catch {
    return u;
  }
}
