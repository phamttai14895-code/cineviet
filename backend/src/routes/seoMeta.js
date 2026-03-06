/**
 * SEO meta cho crawler/bot: trả JSON meta theo path hoặc HTML có og/twitter meta.
 * Dùng khi Nginx proxy request của bot (Facebook, Google, Telegram...) tới backend để lấy đúng title/description/ảnh.
 */
import db from '../config/db.js';

const BOT_UA_PATTERN = /bot|crawler|facebookexternalhit|twitterbot|telegram|whatsapp|slurp|googlebot|bingbot|yandex|duckduckbot/i;

export function isBotUserAgent(ua) {
  return !!(ua && BOT_UA_PATTERN.test(ua));
}

/**
 * Lấy meta (title, description, image) cho path. Path dạng /movie/slug hoặc /movie/123.
 */
export function getMetaByPath(path, baseUrl) {
  if (!path || typeof path !== 'string') return null;
  const p = path.replace(/^\//, '').trim();
  const parts = p.split('/');
  const origin = (baseUrl || '').replace(/\/$/, '');

  if (parts[0] === 'movie' && parts[1]) {
    const idOrSlug = parts[1];
    const isNum = /^\d+$/.test(idOrSlug);
    const movie = db.prepare(
      `SELECT id, title, slug, description, poster, backdrop FROM movies WHERE (status IS NULL OR status = 'published') AND ${isNum ? 'id' : 'slug'} = ?`
    ).get(idOrSlug);
    if (!movie) return null;
    const title = (movie.title || '').trim() || 'Phim';
    const description = (movie.description || '').trim().replace(/<[^>]+>/g, '').slice(0, 200) || `Xem phim ${title} - CineViet`;
    let image = (movie.poster || movie.backdrop || '').trim();
    if (image && !image.startsWith('http')) image = origin + (image.startsWith('/') ? '' : '/') + image;
    const url = origin + '/movie/' + (movie.slug || movie.id);
    return { title: `${title} | CineViet`, description, image: image || null, url };
  }

  if (parts[0] === 'dien-vien' && parts[1]) {
    const actor = db.prepare('SELECT id, name, avatar, biography FROM actors WHERE slug = ?').get(parts[1]);
    if (!actor) return null;
    const title = (actor.name || '').trim() || 'Diễn viên';
    const description = (actor.biography || '').trim().slice(0, 200) || `Diễn viên ${title} - CineViet`;
    let image = (actor.avatar || '').trim();
    if (image && !image.startsWith('http')) image = origin + (image.startsWith('/') ? '' : '/') + image;
    const url = origin + '/dien-vien/' + parts[1];
    return { title: `${title} | CineViet`, description, image: image || null, url };
  }

  return null;
}

/**
 * Render HTML minimal với og/twitter meta để bot nhận đúng khi share link.
 */
export function renderSeoHtml(meta, baseUrl) {
  const origin = (baseUrl || '').replace(/\/$/, '');
  const t = meta.title || 'CineViet - Xem phim trực tuyến';
  const d = meta.description || 'Xem phim online miễn phí, phim lẻ, phim bộ, anime. Chất lượng HD, cập nhật nhanh.';
  const img = meta.image || '';
  const url = meta.url || origin + '/';
  const safe = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safe(t)}</title>
  <meta name="description" content="${safe(d)}" />
  <link rel="canonical" href="${safe(url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="vi_VN" />
  <meta property="og:title" content="${safe(t)}" />
  <meta property="og:description" content="${safe(d)}" />
  <meta property="og:url" content="${safe(url)}" />
  ${img ? `<meta property="og:image" content="${safe(img)}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safe(t)}" />
  <meta name="twitter:description" content="${safe(d)}" />
  ${img ? `<meta name="twitter:image" content="${safe(img)}" />` : ''}
  <meta http-equiv="refresh" content="0;url=${safe(url)}" />
</head>
<body><p>Đang chuyển hướng...</p><script>location.href=${JSON.stringify(url)};</script></body>
</html>`;
}
