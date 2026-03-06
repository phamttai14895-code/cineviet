import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Chỉ cho phép ảnh: MIME image/* và extension .jpg, .jpeg, .png, .gif, .webp
const ALLOWED_AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_AVATAR_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const avatarUpload = multer({
  dest: uploadDir,
  fileFilter(req, file, cb) {
    const mimetype = (file.mimetype || '').toLowerCase();
    const ext = path.extname((file.originalname || '').toLowerCase());
    if (ALLOWED_AVATAR_MIMES.includes(mimetype) && ALLOWED_AVATAR_EXT.includes(ext)) {
      return cb(null, true);
    }
    cb(null, false);
  },
});

router.use(requireAuth);

// Đảm bảo bảng comment_reports tồn tại (migration khi chưa chạy initDb)
function ensureCommentReportsTable() {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='comment_reports'").get();
  if (!exists) {
    db.exec(`
      CREATE TABLE comment_reports (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT (datetime('now','+7 hours')),
        PRIMARY KEY (user_id, comment_id)
      );
      CREATE INDEX IF NOT EXISTS idx_comment_reports_user ON comment_reports(user_id);
      CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON comment_reports(comment_id);
    `);
  }
}

// Đảm bảo bảng watch_reports tồn tại (báo lỗi khi xem phim)
function ensureWatchReportsTable() {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='watch_reports'").get();
  if (!exists) {
    db.exec(`
      CREATE TABLE watch_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
        episode INTEGER NOT NULL DEFAULT 1,
        report_type TEXT NOT NULL DEFAULT 'other',
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'resolved')),
        created_at DATETIME DEFAULT (datetime('now','+7 hours')),
        updated_at DATETIME DEFAULT (datetime('now','+7 hours'))
      );
      CREATE INDEX IF NOT EXISTS idx_watch_reports_movie ON watch_reports(movie_id);
      CREATE INDEX IF NOT EXISTS idx_watch_reports_status ON watch_reports(status);
      CREATE INDEX IF NOT EXISTS idx_watch_reports_created ON watch_reports(created_at);
    `);
  }
}

// Upload avatar (click vào avatar -> chọn file)
router.post('/avatar', avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn ảnh hoặc định dạng không hợp lệ. Chỉ chấp nhận ảnh: JPG, PNG, GIF, WebP.' });
  const avatarPath = '/uploads/' + req.file.filename;
  db.prepare("UPDATE users SET avatar = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(avatarPath, req.user.id);
  const user = db.prepare('SELECT id, email, name, avatar, role FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Tên cấm đặt (trừ user role admin)
const RESERVED_DISPLAY_NAMES = ['admin', 'admin cineviet', 'administrator'];

// Cập nhật profile (avatar URL, tên)
router.patch('/profile', (req, res) => {
  const { name, avatar } = req.body || {};
  const updates = [];
  const params = [];
  if (typeof name === 'string' && name.trim()) {
    const trimmed = name.trim();
    const isReserved = RESERVED_DISPLAY_NAMES.includes(trimmed.toLowerCase());
    if (isReserved && req.user?.role !== 'admin') {
      return res.status(400).json({ error: 'Tên hiển thị này không được phép sử dụng.' });
    }
    updates.push('name = ?');
    params.push(trimmed);
  }
  if (typeof avatar === 'string') {
    updates.push('avatar = ?');
    params.push(avatar.trim() || null);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Cần name hoặc avatar' });
  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now','+7 hours') WHERE id = ?`).run(...params);
  const user = db.prepare('SELECT id, email, name, avatar, role FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Cài đặt thông báo: GET
router.get('/notification-settings', (req, res) => {
  const row = db.prepare(
    'SELECT notify_phim_moi, notify_tap_moi, notify_watch_party, notify_uu_dai FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy user' });
  res.json({
    phim_moi: !!row.notify_phim_moi,
    tap_moi: !!row.notify_tap_moi,
    watch_party: !!row.notify_watch_party,
    uu_dai: !!row.notify_uu_dai,
  });
});

// Cài đặt thông báo: PATCH
router.patch('/notification-settings', (req, res) => {
  const body = req.body || {};
  const updates = [];
  const params = [];
  if (typeof body.phim_moi === 'boolean') {
    updates.push('notify_phim_moi = ?');
    params.push(body.phim_moi ? 1 : 0);
  }
  if (typeof body.tap_moi === 'boolean') {
    updates.push('notify_tap_moi = ?');
    params.push(body.tap_moi ? 1 : 0);
  }
  if (typeof body.watch_party === 'boolean') {
    updates.push('notify_watch_party = ?');
    params.push(body.watch_party ? 1 : 0);
  }
  if (typeof body.uu_dai === 'boolean') {
    updates.push('notify_uu_dai = ?');
    params.push(body.uu_dai ? 1 : 0);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Cần ít nhất một trường cập nhật' });
  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now','+7 hours') WHERE id = ?`).run(...params);
  const row = db.prepare(
    'SELECT notify_phim_moi, notify_tap_moi, notify_watch_party, notify_uu_dai FROM users WHERE id = ?'
  ).get(req.user.id);
  res.json({
    phim_moi: !!row.notify_phim_moi,
    tap_moi: !!row.notify_tap_moi,
    watch_party: !!row.notify_watch_party,
    uu_dai: !!row.notify_uu_dai,
  });
});

// Đổi mật khẩu (chỉ tài khoản có password, không OAuth)
router.post('/change-password', (req, res) => {
  const current = req.body?.current_password ?? req.body?.currentPassword;
  const newPass = req.body?.new_password ?? req.body?.newPassword;
  if (!current || !newPass || newPass.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 6 ký tự' });
  }
  const row = db.prepare('SELECT id, password, provider FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy user' });
  if (row.provider) return res.status(400).json({ error: 'Tài khoản đăng nhập bằng mạng xã hội không đổi mật khẩu tại đây' });
  const ok = bcrypt.compareSync(current, row.password);
  if (!ok) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  const hash = bcrypt.hashSync(newPass, 10);
  db.prepare("UPDATE users SET password = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(hash, req.user.id);
  res.json({ ok: true });
});

// Danh sách thông báo: Phim mới tuần này (1 thẻ), Tập mới (phim yêu thích/đã xem). Không ưu đãi, không watch party.
router.get('/notifications', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 30);
  const row = db.prepare(
    'SELECT notify_phim_moi, notify_tap_moi, notification_read_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!row) return res.json({ notifications: [], unreadCount: 0 });

  const items = [];
  const statusCond = "(m.status IS NULL OR m.status = 'published')";
  const readAt = row.notification_read_at ? new Date(row.notification_read_at) : null;

  if (row.notify_phim_moi) {
    const phimRow = db.prepare(`
      SELECT COUNT(*) as c, MAX(COALESCE(m.updated_at, m.created_at)) as last_at
      FROM movies m
      WHERE ${statusCond}
        AND datetime(COALESCE(m.updated_at, m.created_at)) >= datetime('now','+7 hours','-7 days')
    `).get();
    const count = phimRow?.c ?? 0;
    if (count > 0) {
      items.push({
        type: 'phim_moi_tuan',
        title: 'Phim mới tuần này',
        description: `${count} phim mới được thêm vào hệ thống`,
        link: '/phim-moi',
        at: phimRow?.last_at || new Date().toISOString(),
      });
    }
  }

  if (row.notify_tap_moi) {
    const favAndWatched = db.prepare(`
      SELECT DISTINCT movie_id FROM (
        SELECT movie_id FROM user_favorites WHERE user_id = ?
        UNION
        SELECT movie_id FROM watch_history WHERE user_id = ?
      )
    `).all(req.user.id, req.user.id);
    const movieIds = favAndWatched.map((r) => r.movie_id).filter(Boolean);
    if (movieIds.length > 0) {
      const placeholders = movieIds.map(() => '?').join(',');
      const series = db.prepare(`
        SELECT m.id, m.title, m.slug, m.total_episodes, m.episode_current, COALESCE(m.updated_at, m.created_at) as at
        FROM movies m
        WHERE m.id IN (${placeholders})
          AND m.type = 'series'
          AND ${statusCond}
          AND datetime(COALESCE(m.updated_at, m.created_at)) >= datetime('now','+7 hours','-7 days')
        ORDER BY m.updated_at DESC
        LIMIT 15
      `).all(...movieIds);
      series.forEach((r) => {
        const tapMoi = r.episode_current != null ? r.episode_current : (r.total_episodes || 'mới');
        items.push({
          type: 'tap_moi',
          id: r.id,
          title: `${r.title} mới cập nhật tập ${tapMoi}${r.total_episodes ? ` / ${r.total_episodes}` : ''}`,
          description: 'Tập mới vừa được cập nhật',
          link: `/movie/${r.slug || r.id}`,
          at: r.at,
        });
      });
    }
  }

  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  const notifications = items.slice(0, limit);
  const unreadCount = readAt
    ? notifications.filter((n) => new Date(n.at) > readAt).length
    : notifications.length;

  res.json({ notifications, unreadCount });
});

// Đánh dấu đã đọc tất cả thông báo
router.post('/notifications/read', (req, res) => {
  db.prepare(
    "UPDATE users SET notification_read_at = datetime('now','+7 hours') WHERE id = ?"
  ).run(req.user.id);
  res.json({ ok: true });
});

// Thống kê nhanh (số lượng)
router.get('/stats', (req, res) => {
  const fav = db.prepare('SELECT COUNT(*) as c FROM user_favorites WHERE user_id = ?').get(req.user.id);
  const hist = db.prepare('SELECT COUNT(DISTINCT movie_id) as c FROM watch_history WHERE user_id = ?').get(req.user.id);
  res.json({
    favoritesCount: fav?.c ?? 0,
    historyCount: hist?.c ?? 0,
    watchLaterCount: 0,
  });
});

// Profile: favorites & watch history
router.get('/favorites', (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, GROUP_CONCAT(g.name) as genres
    FROM user_favorites uf
    JOIN movies m ON m.id = uf.movie_id
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    WHERE uf.user_id = ?
    GROUP BY m.id
    ORDER BY uf.created_at DESC
  `).all(req.user.id);
  res.json(rows.map((m) => ({ ...m, genres: m.genres ? m.genres.split(',') : [] })));
});

// Tiến độ xem một phim (đồng bộ đa thiết bị: progress %, episode để tiếp tục đúng tập)
router.get('/progress/:movieId', (req, res) => {
  const movieId = parseInt(req.params.movieId);
  if (!movieId) return res.status(400).json({ error: 'Thiếu movie_id' });
  const row = db.prepare('SELECT progress, completed, episode, position_seconds FROM watch_history WHERE user_id = ? AND movie_id = ?').get(req.user.id, movieId);
  res.json({
    progress: row?.progress ?? 0,
    completed: row?.completed ?? 0,
    episode: row?.episode ?? 1,
    position_seconds: row?.position_seconds != null ? Number(row.position_seconds) : null,
  });
});

router.get('/history', (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, wh.progress, wh.completed, wh.episode, wh.watched_at, GROUP_CONCAT(g.name) as genres
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    WHERE wh.user_id = ?
    GROUP BY wh.id
    ORDER BY wh.watched_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(rows.map((m) => ({ ...m, genres: m.genres ? m.genres.split(',') : [] })));
});

// Xóa một phim khỏi lịch sử xem (tiếp tục xem)
router.delete('/history/:movieId', (req, res) => {
  const movieId = parseInt(req.params.movieId);
  if (!movieId) return res.status(400).json({ error: 'Thiếu movie_id' });
  db.prepare('DELETE FROM watch_history WHERE user_id = ? AND movie_id = ?').run(req.user.id, movieId);
  res.json({ ok: true });
});

router.get('/favorite-ids', (req, res) => {
  const rows = db.prepare('SELECT movie_id FROM user_favorites WHERE user_id = ?').all(req.user.id);
  res.json(rows.map((r) => r.movie_id));
});

// Báo cáo bình luận (lưu vào comment_reports, mỗi user chỉ tính 1 lần)
router.post('/report-comment', (req, res) => {
  try {
    ensureCommentReportsTable();
    const commentId = parseInt(req.body?.comment_id);
    if (!commentId) return res.status(400).json({ error: 'Thiếu comment_id' });
    const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(commentId);
    if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận' });
    const insert = db.prepare('INSERT OR IGNORE INTO comment_reports (user_id, comment_id) VALUES (?, ?)').run(req.user.id, commentId);
    if (insert.changes > 0) {
      db.prepare('UPDATE comments SET reported_count = reported_count + 1 WHERE id = ?').run(commentId);
    }
    res.json({ ok: true, reported: insert.changes > 0 });
  } catch (err) {
    console.error('report-comment:', err);
    res.status(500).json({ error: err.message || 'Lỗi khi báo cáo bình luận' });
  }
});

// Danh sách id bình luận mà user hiện tại đã báo cáo (để hiển thị "Đã báo cáo" sau khi refresh)
router.get('/reported-comment-ids', (req, res) => {
  try {
    ensureCommentReportsTable();
    const rows = db.prepare('SELECT comment_id FROM comment_reports WHERE user_id = ?').all(req.user.id);
    res.json({ comment_ids: rows.map((r) => r.comment_id) });
  } catch (err) {
    console.error('reported-comment-ids:', err);
    res.status(500).json({ error: err.message || 'Lỗi khi tải danh sách báo cáo' });
  }
});

// Báo lỗi khi xem phim (từ trang Watch)
router.post('/report-watch', (req, res) => {
  try {
    ensureWatchReportsTable();
    const movieId = parseInt(req.body?.movie_id, 10);
    const episode = Math.max(1, parseInt(req.body?.episode, 10) || 1);
    const reportType = ['video_error', 'subtitle', 'wrong_episode', 'other'].includes(req.body?.report_type)
      ? req.body.report_type
      : 'other';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1000) : '';
    if (!movieId) return res.status(400).json({ error: 'Thiếu movie_id' });
    const movie = db.prepare('SELECT id FROM movies WHERE id = ?').get(movieId);
    if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
    db.prepare(`
      INSERT INTO watch_reports (user_id, movie_id, episode, report_type, message, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(req.user.id, movieId, episode, reportType, message || '');
    res.json({ ok: true });
  } catch (err) {
    console.error('report-watch:', err);
    res.status(500).json({ error: err.message || 'Lỗi khi gửi báo cáo' });
  }
});

export default router;
