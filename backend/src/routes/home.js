/**
 * API dữ liệu cho block trang chủ: TOP BÌNH LUẬN, SÔI NỔI NHẤT, YÊU THÍCH NHẤT, BÌNH LUẬN MỚI
 * Sôi nổi nhất = lượt xem trong tháng (view_count_month).
 * Yêu thích nhất = số user bấm yêu thích (favorite_count).
 */
import { Router } from 'express';
import db from '../config/db.js';
import { ensureViewCountDayMonthReset } from '../utils/viewCountReset.js';

const router = Router();
const TOP_COMMENTS_LIMIT = 8;
const POPULAR_LIMIT = 10;
const MOST_LIKED_LIMIT = 10;
const NEW_COMMENTS_LIMIT = 10;

router.get('/trending-block', (req, res) => {
  try {
    ensureViewCountDayMonthReset();

    // Top bình luận (carousel): bình luận mới nhất, có thông tin user + phim
    const topComments = db.prepare(`
      SELECT c.id, c.content, c.created_at, c.movie_id,
             u.name as user_name, u.avatar as user_avatar,
             m.title as movie_title, m.slug as movie_slug, m.poster as movie_poster, m.thumbnail as movie_thumbnail
      FROM comments c
      JOIN users u ON u.id = c.user_id
      JOIN movies m ON m.id = c.movie_id
      WHERE c.status = 'visible'
      ORDER BY c.created_at DESC
      LIMIT ?
    `).all(TOP_COMMENTS_LIMIT);

    // Sôi nổi nhất: lượt xem trong tháng (view_count_month)
    const popularMovies = db.prepare(`
      SELECT id, title, slug, poster, thumbnail, COALESCE(view_count_month, 0) as view_count_month
      FROM movies
      WHERE (status IS NULL OR status = 'published')
      ORDER BY view_count_month DESC
      LIMIT ?
    `).all(POPULAR_LIMIT);

    // Yêu thích nhất: phim được ấn yêu thích nhiều nhất (số user đã thích)
    const mostLikedMovies = db.prepare(`
      SELECT m.id, m.title, m.slug, m.poster, m.thumbnail,
             COUNT(uf.user_id) as favorite_count
      FROM movies m
      JOIN user_favorites uf ON uf.movie_id = m.id
      WHERE (m.status IS NULL OR m.status = 'published')
      GROUP BY m.id
      ORDER BY favorite_count DESC
      LIMIT ?
    `).all(MOST_LIKED_LIMIT);

    // Bình luận mới: giống top nhưng limit lớn hơn cho cột phải
    const newComments = db.prepare(`
      SELECT c.id, c.content, c.created_at, c.movie_id,
             u.name as user_name, u.avatar as user_avatar,
             m.title as movie_title, m.slug as movie_slug, m.poster as movie_poster, m.thumbnail as movie_thumbnail
      FROM comments c
      JOIN users u ON u.id = c.user_id
      JOIN movies m ON m.id = c.movie_id
      WHERE c.status = 'visible'
      ORDER BY c.created_at DESC
      LIMIT ?
    `).all(NEW_COMMENTS_LIMIT);

    const totalCommentsRow = db.prepare(`
      SELECT COUNT(*) as total FROM comments WHERE status = 'visible'
    `).get();

    res.json({
      topComments,
      popularMovies,
      mostLikedMovies,
      newComments,
      totalComments: totalCommentsRow?.total ?? 0,
    });
  } catch (err) {
    console.error('trending-block:', err);
    res.status(500).json({ error: 'Lỗi tải dữ liệu' });
  }
});

export default router;
