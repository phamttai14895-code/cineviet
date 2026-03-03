import db from '../config/db.js';

const STATIC_PATHS = [
  '/',
  '/phim-moi',
  '/phim-bo',
  '/phim-le',
  '/anime',
  '/tv-shows',
  '/phim-chieu-rap',
  '/the-loai',
  '/quoc-gia',
  '/dien-vien',
  '/goi-y',
  '/xem-chung',
  '/tim-kiem',
  '/lien-he',
  '/dieu-khoan',
  '/bao-mat',
  '/dmca',
  '/sitemap',
  '/register',
];

/**
 * GET /api/sitemap.xml — trả về XML sitemap cho crawler.
 * Base URL từ FRONTEND_URL hoặc request host.
 */
export default function sitemapHandler(req, res) {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '') || (req.protocol + '://' + (req.get('host') || 'localhost'));
  const baseUrl = base.startsWith('http') ? base : `https://${base}`;

  const urls = [...STATIC_PATHS];

  try {
    const movies = db.prepare('SELECT id, slug, updated_at FROM movies WHERE (status IS NULL OR status = ?) ORDER BY id LIMIT 5000').all('published');
    movies.forEach((m) => {
      urls.push({ path: `/movie/${m.slug || m.id}`, lastmod: m.updated_at });
    });

    const actors = db.prepare('SELECT slug FROM actors ORDER BY id LIMIT 2000').all();
    actors.forEach((a) => {
      if (a.slug) urls.push({ path: `/dien-vien/${a.slug}` });
    });
  } catch (_) {}

  const lastmod = (item) => {
    if (item && typeof item === 'object' && item.lastmod) {
      const d = new Date(item.lastmod);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  };

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => {
      const path = typeof u === 'string' ? u : u.path;
      const loc = path.startsWith('http') ? path : `${baseUrl}${path}`;
      const lm = typeof u === 'object' ? lastmod(u) : lastmod(null);
      return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${lm}</lastmod><changefreq>weekly</changefreq><priority>${path === '/' ? '1.0' : path.startsWith('/movie/') ? '0.9' : '0.8'}</priority></url>`;
    }),
    '</urlset>',
  ].join('\n');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
}

function escapeXml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
