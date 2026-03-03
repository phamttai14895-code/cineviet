/**
 * API crawl nguồn KKPhim (PhimAPI): lấy chi tiết phim, trang chủ, tìm kiếm.
 * Import vào DB qua POST /api/admin/crawl/import (cần đăng nhập admin).
 */

import { Router } from 'express';
import {
  getMovieBySlug,
  getHome,
  search,
  getGenres,
  getCountries,
  getYears,
} from '../services/crawlMerge.js';
import db from '../config/db.js';

const router = Router();

/** GET /api/crawl/movie?slug=xxx - Chi tiết phim từ KKPhim (dùng cho trang xem phim) */
router.get('/movie', async (req, res) => {
  const slug = (req.query.slug || '').trim();
  if (!slug) {
    return res.status(400).json({ error: 'Thiếu tham số slug' });
  }
  try {
    const movie = await getMovieBySlug(slug);
    if (!movie) {
      return res.status(404).json({ error: 'Không tìm thấy phim từ các nguồn' });
    }
    res.json(movie);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi khi crawl phim' });
  }
});

/** GET /api/crawl/home?source=phimapi&page=1 */
router.get('/home', async (req, res) => {
  const source = (req.query.source || 'phimapi').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  try {
    const data = await getHome(source, page);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi khi lấy danh sách' });
  }
});

/** GET /api/crawl/search?keyword=xxx&source=phimapi&page=1 */
router.get('/search', async (req, res) => {
  const keyword = (req.query.keyword || '').trim();
  const source = (req.query.source || 'phimapi').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  try {
    const data = await search(keyword, source, page);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi khi tìm kiếm' });
  }
});

/** GET /api/crawl/genres - Thể loại (KKPhim/PhimAPI) */
router.get('/genres', async (req, res) => {
  try {
    const items = await getGenres();
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi khi lấy thể loại' });
  }
});

/** GET /api/crawl/countries - Quốc gia (KKPhim/PhimAPI) */
router.get('/countries', async (req, res) => {
  try {
    const items = await getCountries();
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi khi lấy quốc gia' });
  }
});

/** GET /api/crawl/years - Năm phát hành (danh sách sinh từ năm hiện tại) */
router.get('/years', async (req, res) => {
  try {
    const items = await getYears();
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi khi lấy năm' });
  }
});

export default router;
