/**
 * Proxy ảnh từ nguồn crawl (Ophim, PhimAPI, Nguonc) để tránh bị chặn hotlink/Referer.
 * Trên nguồn ảnh xem được, nhưng khi embed vào site khác CDN trả 403 — proxy request từ server với Referer giả.
 */

import { Router } from 'express';
import { Readable } from 'stream';

const router = Router();

const ALLOWED_HOSTS = [
  'img.ophim.live',
  'img.ophim.cc',
  'ophim.live',
  'ophim1.com',
  'ophim.cc',
  'phimapi.com',
  'img.phimapi.com',
  'phim.nguonc.com',
  'via.placeholder.com',
  'placehold.co',
  'image.tmdb.org',
];

function isAllowedImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) return false;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** CDN Ophim chặn hotlink: cần Referer + Origin từ trang chủ (ophim.cc). TMDB thường cho phép embed. */
const REFERER_FOR_HOST = {
  'img.ophim.live': 'https://ophim.cc/',
  'img.ophim.cc': 'https://ophim.cc/',
  'ophim.live': 'https://ophim.cc/',
  'ophim1.com': 'https://ophim.cc/',
  'ophim.cc': 'https://ophim.cc/',
  'phimapi.com': 'https://phimapi.com/',
  'img.phimapi.com': 'https://phimapi.com/',
  'phim.nguonc.com': 'https://phim.nguonc.com/',
  'image.tmdb.org': 'https://www.themoviedb.org/',
};

function getHeadersForUrl(targetUrl) {
  const out = { 'User-Agent': USER_AGENT };
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    for (const [h, ref] of Object.entries(REFERER_FOR_HOST)) {
      if (host === h || host.endsWith('.' + h)) {
        out.Referer = ref;
        const origin = ref.replace(/\/+$/, '');
        if (h.includes('ophim')) out.Origin = origin; // Ophim CDN có thể kiểm tra Origin
        return out;
      }
    }
    out.Referer = `${new URL(targetUrl).protocol}//${new URL(targetUrl).host}/`;
  } catch {}
  return out;
}

router.get('/', (req, res) => {
  const raw = req.query.url;
  if (!raw) {
    return res.status(400).json({ error: 'Thiếu tham số url' });
  }
  let targetUrl;
  try {
    targetUrl = decodeURIComponent(raw);
  } catch {
    return res.status(400).json({ error: 'Url không hợp lệ' });
  }
  if (!isAllowedImageUrl(targetUrl)) {
    return res.status(403).json({ error: 'Nguồn ảnh không được phép' });
  }

  const headers = getHeadersForUrl(targetUrl);

  const TIMEOUT_MS = 15000;

  (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const r = await fetch(targetUrl, {
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!r.ok) {
        if (!res.headersSent) res.status(r.status).send(r.statusText);
        return;
      }
      const ct = r.headers.get('content-type') || 'image/jpeg';
      res.setHeader('content-type', ct);
      res.setHeader('cache-control', 'public, max-age=86400');
      const stream = Readable.fromWeb(r.body);
      stream.on('error', (err) => {
        if (!res.headersSent) res.status(502).json({ error: 'Không tải được ảnh' });
        try { res.destroy(); } catch (_) {}
      });
      res.on('error', () => {
        try { stream.destroy(); } catch (_) {}
      });
      stream.pipe(res);
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      const isReset = err.code === 'ECONNRESET' || err.message?.includes('ECONNRESET');
      if (!isAbort && !isReset) console.error('[image proxy]', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Không tải được ảnh' });
    }
  })();
});

export default router;
