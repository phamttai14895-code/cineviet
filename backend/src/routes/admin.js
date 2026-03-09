import { Router } from 'express';
import db from '../config/db.js';
import settingsConfig from '../config/settings.js';
import { getMovieBySlug, getHome } from '../services/crawlMerge.js';
import { sanitizeImageUrl } from '../services/normalizeMovie.js';
import { fetchTmdbCredits, parseTmdbCredits, searchTmdbByTitle, fetchTmdbPersonWithAvatar } from '../services/tmdbCredits.js';
import { rewriteMovieDescription } from '../services/aiRecommend.js';
import requestLogger from '../config/requestLogger.js';
import crawlLogger from '../config/crawlLogger.js';
import realtimeStore from '../config/realtimeStore.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { slugify, parseSeriesFromSlug } from '../utils/slugify.js';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads');
const adsDir = path.join(uploadDir, 'ads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(adsDir)) fs.mkdirSync(adsDir, { recursive: true });

const upload = multer({ dest: uploadDir });
const uploadVast = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, adsDir),
    filename: (_, __, cb) => cb(null, 'vast.xml'),
  }),
});

const AD_ZONES = ['popup', 'footer_banner', 'below_featured', 'sidebar_left', 'sidebar_right'];

/** Chuyển created_at từ SQLite UTC sang chuỗi GMT+7 để frontend hiển thị đúng (users table dùng CURRENT_TIMESTAMP = UTC). */
function utcToGmt7String(utcStr) {
  if (!utcStr) return utcStr;
  const s = String(utcStr).trim().replace(' ', 'T');
  const hasTz = /Z$|[-+]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : s + 'Z');
  if (Number.isNaN(d.getTime())) return utcStr;
  return d.toLocaleString('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(' ', 'T');
}
const uploadAdZone = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, adsDir),
    filename: (req, file, cb) => {
      const type = req.body?.type || req.body?.zone || 'popup';
      const safe = AD_ZONES.includes(type) ? type : 'popup';
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${safe}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, !!ok);
  },
});

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// Stats (cơ bản + mở rộng cho dashboard)
router.get('/stats', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) as c FROM users').get();
  const movies = db.prepare('SELECT COUNT(*) as c FROM movies').get();
  const views = db.prepare('SELECT COALESCE(SUM(view_count), 0) as c FROM movies').get();
  const viewsToday = db.prepare(`
    SELECT COUNT(*) as c FROM watch_history WHERE date(watched_at) = date('now','+7 hours')
  `).get();
  const newUsersToday = db.prepare(`
    SELECT COUNT(*) as c FROM users WHERE date(created_at) = date('now','+7 hours')
  `).get();
  const newMoviesThisMonth = db.prepare(`
    SELECT COUNT(*) as c FROM movies WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','+7 hours')
  `).get();
  const yesterdayViews = db.prepare(`
    SELECT COUNT(*) as c FROM watch_history WHERE date(watched_at) = date('now','+7 hours','-1 day')
  `).get();
  const prevViewsToday = viewsToday.c;
  const prevYesterday = yesterdayViews.c;
  const percentViews = prevYesterday > 0 ? Math.round(((prevViewsToday - prevYesterday) / prevYesterday) * 1000) / 10 : 0;
  res.json({
    users: users.c,
    movies: movies.c,
    totalViews: views.c,
    viewsToday: viewsToday.c,
    newUsersToday: newUsersToday.c,
    newMoviesThisMonth: newMoviesThisMonth.c,
    percentViews,
  });
});

// Thống kê VPS: RAM, ổ đĩa, CPU, đang xem trực tiếp, băng thông
router.get('/stats/vps', (req, res) => {
  try {
    const liveStats = realtimeStore.getStats();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0;
    const ramUsedGb = Math.round((usedMem / 1024 / 1024 / 1024) * 100) / 100;
    const ramTotalGb = Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100;

    let diskPercent = 0;
    let diskUsedGb = 0;
    let diskTotalGb = 0;
    try {
      const isWin = process.platform === 'win32';
      if (isWin) {
        const out = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf8', maxBuffer: 4096 });
        const lines = out.trim().split(/\r?\n/).filter(Boolean);
        const match = lines[1].trim().match(/(\d+)\s+(\d+)/);
        if (match) {
          const free = parseInt(match[1], 10) || 0;
          const total = parseInt(match[2], 10) || 0;
          const used = total - free;
          diskTotalGb = Math.round((total / 1024 / 1024 / 1024) * 100) / 100;
          diskUsedGb = Math.round((used / 1024 / 1024 / 1024) * 100) / 100;
          diskPercent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
        }
      } else {
        const out = execSync("df -k / | tail -1 | awk '{print $2,$3}'", { encoding: 'utf8' });
        const [totalK, usedK] = out.trim().split(/\s+/).map(Number);
        const total = (totalK || 0) * 1024;
        const used = (usedK || 0) * 1024;
        diskTotalGb = Math.round((total / 1024 / 1024 / 1024) * 100) / 100;
        diskUsedGb = Math.round((used / 1024 / 1024 / 1024) * 100) / 100;
        diskPercent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
      }
    } catch (_) {
      // df/wmic không có hoặc lỗi
    }

    const cpus = os.cpus().length || 1;
    const loadAvg = os.loadavg();
    const load1 = (loadAvg[0] ?? 0);
    const cpuPercent = Math.min(100, Math.round((load1 / cpus) * 1000) / 10);

    const totalMovies = db.prepare('SELECT COUNT(*) as c FROM movies').get()?.c ?? 0;
    const updatedToday = db.prepare(
      "SELECT COUNT(*) as c FROM movies WHERE date(updated_at) = date('now', 'localtime')"
    ).get()?.c ?? 0;

    res.json({
      liveWatching: liveStats.totalViewers ?? 0,
      bandwidthMbps: 0,
      ramPercent,
      ramUsedGb,
      ramTotalGb,
      diskPercent,
      diskUsedGb,
      diskTotalGb,
      cpuPercent,
      totalMovies,
      updatedToday,
    });
  } catch (err) {
    console.error('VPS stats error:', err);
    res.status(500).json({
      liveWatching: 0,
      bandwidthMbps: 0,
      ramPercent: 0,
      ramUsedGb: 0,
      ramTotalGb: 0,
      diskPercent: 0,
      diskUsedGb: 0,
      diskTotalGb: 0,
      cpuPercent: 0,
      totalMovies: 0,
      updatedToday: 0,
    });
  }
});

// Lượt xem theo ngày (cho biểu đồ)
router.get('/dashboard/views-by-day', (req, res) => {
  const period = req.query.period === '90' ? 90 : req.query.period === '30' ? 30 : 7;
  const views = db.prepare(`
    SELECT date(watched_at) as d, COUNT(*) as views
    FROM watch_history
    WHERE watched_at >= date('now','+7 hours', ?)
    GROUP BY date(watched_at)
    ORDER BY d
  `).all(`-${period} days`);
  const newUsers = db.prepare(`
    SELECT date(created_at) as d, COUNT(*) as c
    FROM users
    WHERE created_at >= date('now','+7 hours', ?)
    GROUP BY date(created_at)
    ORDER BY d
  `).all(`-${period} days`);
  const viewMap = {};
  views.forEach((r) => { viewMap[r.d] = r.views; });
  const userMap = {};
  newUsers.forEach((r) => { userMap[r.d] = r.c; });
  const TZ = 'Asia/Ho_Chi_Minh';
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const days = [];
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(todayStr + 'T12:00:00+07:00');
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-CA', { timeZone: TZ });
    days.push({
      date: key,
      views: viewMap[key] || 0,
      newUsers: userMap[key] || 0,
    });
  }
  res.json(days);
});

// Top phim hôm nay (ưu tiên view_count_day, không có thì theo view_count)
router.get('/dashboard/top-movies', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  const list = db.prepare(`
    SELECT m.id, m.title, m.poster, m.type,
           COALESCE(m.view_count_day, 0) as view_count_day,
           COALESCE(m.view_count, 0) as view_count
    FROM movies m
    ORDER BY COALESCE(m.view_count_day, 0) DESC, m.view_count DESC
    LIMIT ?
  `).all(limit);
  res.json(list);
});

// Người dùng mới đăng ký (vài user gần nhất)
router.get('/dashboard/recent-users', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  const list = db.prepare(`
    SELECT id, email, name, avatar, role, COALESCE(status, 'active') as status, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
  const out = list.map((u) => ({ ...u, created_at: utcToGmt7String(u.created_at) }));
  res.json(out);
});

// Hoạt động gần đây: đăng ký, đăng nhập, bình luận (gộp theo thời gian)
router.get('/dashboard/activity', (req, res) => {
  const limit = parseInt(req.query.limit) || 12;
  const activities = [];
  const newUsers = db.prepare(`
    SELECT name, created_at FROM users ORDER BY created_at DESC LIMIT 8
  `).all();
  newUsers.forEach((u) => {
    activities.push({
      type: 'register',
      text: `${u.name} vừa đăng ký tài khoản`,
      at: utcToGmt7String(u.created_at),
      color: 'green',
    });
  });
  try {
    const logins = db.prepare(`
      SELECT ll.logged_at, u.name
      FROM login_log ll
      JOIN users u ON u.id = ll.user_id
      ORDER BY ll.logged_at DESC
      LIMIT 8
    `).all();
    logins.forEach((l) => {
      activities.push({
        type: 'login',
        text: `${l.name} vừa đăng nhập`,
        at: l.logged_at,
        color: 'blue',
      });
    });
  } catch (_) { /* bảng login_log chưa có */ }
  const comments = db.prepare(`
    SELECT c.created_at, u.name as user_name, m.title as movie_title
    FROM comments c
    JOIN users u ON u.id = c.user_id
    JOIN movies m ON m.id = c.movie_id
    ORDER BY c.created_at DESC
    LIMIT 8
  `).all();
  comments.forEach((c) => {
    activities.push({
      type: 'comment',
      text: `${c.user_name} vừa bình luận về "${c.movie_title}"`,
      at: c.created_at,
      color: 'orange',
    });
  });
  activities.sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json(activities.slice(0, limit));
});

// ========== Comments (Quản lý bình luận) ==========
router.get('/comments', (req, res) => {
  const filter = req.query.filter === 'reported' ? 'reported' : 'all';
  let sql = `
    SELECT c.id, c.user_id, c.movie_id, c.content, c.status, c.reported_count, c.created_at,
           u.name as user_name,
           m.title as movie_title
    FROM comments c
    JOIN users u ON u.id = c.user_id
    JOIN movies m ON m.id = c.movie_id
  `;
  const params = [];
  if (filter === 'reported') {
    sql += ` WHERE c.reported_count > 0`;
  }
  sql += ` ORDER BY c.created_at DESC`;
  const list = db.prepare(sql).all(...params);
  res.json(list);
});

router.get('/comments/reported-count', (req, res) => {
  const r = db.prepare('SELECT COUNT(*) as c FROM comments WHERE reported_count > 0').get();
  res.json({ count: r.c });
});

router.patch('/comments/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const status = req.body.status === 'hidden' ? 'hidden' : 'visible';
  const r = db.prepare('UPDATE comments SET status = ? WHERE id = ?').run(status, id);
  if (r.changes === 0) return res.status(404).json({ error: 'Không tìm thấy bình luận' });
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  res.json(comment);
});

router.delete('/comments/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const r = db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Không tìm thấy bình luận' });
  res.json({ deleted: id });
});

// Báo cáo lỗi khi xem phim (watch_reports)
router.get('/reports', (req, res) => {
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='watch_reports'").get();
  if (!tableExists) {
    return res.json({ reports: [], total: 0 });
  }
  const statusFilter = req.query.status === 'resolved' ? 'resolved' : req.query.status === 'pending' ? 'pending' : '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  let where = '';
  const params = [];
  if (statusFilter) {
    where = ' WHERE r.status = ?';
    params.push(statusFilter);
  }
  const countRow = db.prepare(`SELECT COUNT(*) as c FROM watch_reports r ${where}`).get(...params);
  const list = db.prepare(`
    SELECT r.id, r.user_id, r.movie_id, r.episode, r.report_type, r.message, r.status, r.created_at, r.updated_at,
           m.title as movie_title, m.slug as movie_slug,
           u.name as user_name, u.email as user_email
    FROM watch_reports r
    LEFT JOIN movies m ON m.id = r.movie_id
    LEFT JOIN users u ON u.id = r.user_id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  res.json({ reports: list, total: countRow.c });
});

router.get('/reports/count', (req, res) => {
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='watch_reports'").get();
  if (!tableExists) return res.json({ count: 0, pending: 0 });
  const total = db.prepare('SELECT COUNT(*) as c FROM watch_reports').get();
  const pending = db.prepare("SELECT COUNT(*) as c FROM watch_reports WHERE status = 'pending'").get();
  res.json({ count: total.c, pending: pending.c });
});

router.patch('/reports/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const status = req.body.status === 'resolved' ? 'resolved' : req.body.status === 'pending' ? 'pending' : null;
  if (status === null) return res.status(400).json({ error: 'status phải là pending hoặc resolved' });
  const r = db.prepare("UPDATE watch_reports SET status = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(status, id);
  if (r.changes === 0) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
  const row = db.prepare(`
    SELECT r.id, r.user_id, r.movie_id, r.episode, r.report_type, r.message, r.status, r.created_at, r.updated_at,
           m.title as movie_title, m.slug as movie_slug,
           u.name as user_name, u.email as user_email
    FROM watch_reports r
    LEFT JOIN movies m ON m.id = r.movie_id
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.id = ?
  `).get(id);
  res.json(row);
});

router.delete('/reports/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Thiếu id báo cáo' });
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='watch_reports'").get();
  if (!tableExists) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
  const r = db.prepare('DELETE FROM watch_reports WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
  res.json({ deleted: id });
});

// Users list (search by email/name, trả về thêm watched count, status)
router.get('/users', (req, res) => {
  const search = (req.query.search || '').trim();
  let sql = `
    SELECT u.id, u.email, u.name, u.avatar, u.role, u.provider, u.created_at,
           COALESCE(u.status, 'active') as status,
           (SELECT COUNT(DISTINCT movie_id) FROM watch_history WHERE user_id = u.id) as watched_count
    FROM users u
  `;
  const params = [];
  if (search) {
    sql += ` WHERE (u.email LIKE ? OR u.name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ` ORDER BY u.created_at DESC`;
  const list = db.prepare(sql).all(...params);
  const out = list.map((u) => ({ ...u, created_at: utcToGmt7String(u.created_at) }));
  res.json(out);
});

// Cập nhật trạng thái user (khóa/mở khóa)
router.patch('/users/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const status = req.body.status === 'locked' ? 'locked' : 'active';
  const existing = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy user' });
  if (existing.role === 'admin') return res.status(403).json({ error: 'Không thể khóa tài khoản admin' });
  db.prepare("UPDATE users SET status = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(status, id);
  const user = db.prepare('SELECT id, email, name, role, status, created_at FROM users WHERE id = ?').get(id);
  if (user) user.created_at = utcToGmt7String(user.created_at);
  res.json(user);
});

// Movies CRUD (hỗ trợ ?search=, ?type=, ?status=)
router.get('/movies', (req, res) => {
  const search = (req.query.search || '').trim();
  const type = req.query.type || '';
  const status = req.query.status || '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  let where = ' WHERE 1=1';
  const params = [];
  if (search) {
    where += ' AND m.title LIKE ?';
    params.push(`%${search}%`);
  }
  if (type) {
    where += ' AND m.type = ?';
    params.push(type);
  }
  if (status) {
    where += ' AND m.status = ?';
    params.push(status);
  }

  const countRow = db.prepare(`SELECT COUNT(DISTINCT m.id) as total FROM movies m ${where}`).get(...params);
  const total = countRow.total || 0;

  const sql = `
    SELECT m.*, GROUP_CONCAT(g.name) as genres, GROUP_CONCAT(g.id) as genre_ids
    FROM movies m
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    ${where}
    GROUP BY m.id ORDER BY m.created_at DESC LIMIT ? OFFSET ?
  `;
  const list = db.prepare(sql).all(...params, limit, offset);
  const movies = list.map((m) => ({
    ...m,
    type: m.type || 'movie',
    status: m.status || 'published',
    country: m.country || '',
    source: m.source || null,
    genres: m.genres ? m.genres.split(',') : [],
    genre_ids: m.genre_ids ? m.genre_ids.split(',').map(Number) : [],
  }));
  res.json({ movies, total, page, limit });
});

// Danh sách phim nổi bật (theo thứ tự hiển thị trang chủ)
router.get('/featured', (req, res) => {
  const list = db.prepare(`
    SELECT m.id, m.title, m.title_en, m.poster, m.backdrop, m.slug, m.release_year, m.rating, m.featured_order, m.created_at
    FROM movies m
    WHERE (m.status IS NULL OR m.status = 'published') AND (m.featured = 1 OR m.featured = ?)
    ORDER BY (CASE WHEN m.featured_order IS NULL THEN 1 ELSE 0 END), m.featured_order ASC, m.created_at DESC
  `).all(1);
  res.json({ movies: list });
});

// Cập nhật thứ tự phim nổi bật (body: { order: number[] } — id theo thứ tự muốn hiển thị)
router.put('/featured/order', (req, res) => {
  const ids = Array.isArray(req.body?.order) ? req.body.order.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0) : [];
  const run = db.transaction(() => {
    ids.forEach((id, index) => {
      db.prepare('UPDATE movies SET featured_order = ? WHERE id = ? AND (featured = 1 OR featured = ?)').run(index, id, 1);
    });
  });
  run();
  res.json({ ok: true });
});

// Chi tiết một phim (để sửa)
router.get('/movies/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Id không hợp lệ' });
  const m = db.prepare(`
    SELECT m.*, GROUP_CONCAT(g.name) as genres, GROUP_CONCAT(g.id) as genre_ids
    FROM movies m
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    WHERE m.id = ?
    GROUP BY m.id
  `).get(id);
  if (!m) return res.status(404).json({ error: 'Không tìm thấy phim' });
  const movie = {
    ...m,
    type: m.type || 'movie',
    status: m.status || 'published',
    country: m.country || '',
    genres: m.genres ? m.genres.split(',') : [],
    genre_ids: m.genre_ids ? m.genre_ids.split(',').map(Number) : [],
  };
  res.json(movie);
});

// Xóa nhiều phim (body: { ids: number[] })
router.post('/movies/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Thiếu danh sách id phim cần xóa' });
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM movie_genres WHERE movie_id IN (${placeholders})`).run(...ids);
  const r = db.prepare(`DELETE FROM movies WHERE id IN (${placeholders})`).run(...ids);
  res.json({ deleted: r.changes });
});

// Xóa toàn bộ phim (body: { confirm: true }). Xóa cả bình luận, lịch sử xem, yêu thích, báo cáo liên quan.
router.post('/movies/delete-all', (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Cần gửi confirm: true để xóa toàn bộ phim' });
  const count = db.prepare('SELECT COUNT(*) as n FROM movies').get();
  const n = count?.n ?? 0;
  if (n === 0) return res.json({ deleted: 0, message: 'Không có phim nào để xóa' });
  db.prepare('DELETE FROM comments').run();
  db.prepare('DELETE FROM watch_reports').run();
  db.prepare('DELETE FROM watch_history').run();
  db.prepare('DELETE FROM user_favorites').run();
  db.prepare('DELETE FROM movie_genres').run();
  const r = db.prepare('DELETE FROM movies').run();
  res.json({ deleted: r.changes, message: `Đã xóa ${r.changes} phim` });
});

router.post(
  '/movies',
  upload.fields([{ name: 'poster', maxCount: 1 }, { name: 'backdrop', maxCount: 1 }]),
  [
    body('title').trim().notEmpty(),
    body('description').optional().trim(),
    body('release_year').optional().isInt({ min: 1900, max: 2030 }),
    body('duration').optional().isInt({ min: 0 }),
    body('trailer_url').optional().trim(),
    body('video_url').optional().trim(),
    body('genre_ids').optional(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const rawSlug = (req.body.slug || '').trim();
    const slug = rawSlug ? slugify(rawSlug) : (slugify(req.body.title) + '-' + Date.now());
    const existingSlug = db.prepare('SELECT id FROM movies WHERE slug = ?').get(slug);
    if (existingSlug) return res.status(400).json({ error: 'Slug đã tồn tại' });
    let poster = req.body.poster_url || '';
    let backdrop = req.body.backdrop_url || '';
    if (req.files?.poster?.[0]) poster = '/uploads/' + req.files.poster[0].filename;
    if (req.files?.backdrop?.[0]) backdrop = '/uploads/' + req.files.backdrop[0].filename;
    const genreIds = Array.isArray(req.body.genre_ids) ? req.body.genre_ids : (req.body.genre_ids && JSON.parse(req.body.genre_ids)) || [];
    const movieType = (req.body.type === 'series' || req.body.type === 'anime' || req.body.type === 'tvshows') ? req.body.type : 'movie';
    const movieStatus = req.body.status === 'pending' ? 'pending' : 'published';
    const country = req.body.country || null;
    const titleEn = req.body.title_en || null;
    const quality = req.body.quality || null;
    const language = req.body.language || null;
    const totalEpisodes = parseInt(req.body.total_episodes) || 0;
    const featured = req.body.featured === true || req.body.featured === '1' ? 1 : 0;
    const seriesKey = (req.body.series_key && String(req.body.series_key).trim()) || null;
    const partNumber = req.body.part_number !== undefined && req.body.part_number !== '' ? Math.max(1, parseInt(req.body.part_number, 10) || 1) : 1;
    const r = db.prepare(`
      INSERT INTO movies (title, title_en, slug, description, poster, backdrop, trailer_url, video_url, duration, release_year, type, status, country, quality, language, total_episodes, featured, series_key, part_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.body.title,
      titleEn,
      slug,
      req.body.description || '',
      poster,
      backdrop,
      req.body.trailer_url || '',
      req.body.video_url || '',
      parseInt(req.body.duration) || 0,
      parseInt(req.body.release_year) || null,
      movieType,
      movieStatus,
      country,
      quality,
      language,
      totalEpisodes,
      featured,
      seriesKey,
      partNumber
    );
    const movieId = r.lastInsertRowid;
    const insertGenre = db.prepare('INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)');
    genreIds.forEach((gid) => insertGenre.run(movieId, parseInt(gid)));
    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);
    res.status(201).json(movie);
  }
);

router.put(
  '/movies/:id',
  upload.fields([{ name: 'poster', maxCount: 1 }, { name: 'backdrop', maxCount: 1 }]),
  (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy phim' });
    let poster = req.body.poster_url ?? existing.poster;
    let backdrop = req.body.backdrop_url ?? existing.backdrop;
    if (req.files?.poster?.[0]) poster = '/uploads/' + req.files.poster[0].filename;
    if (req.files?.backdrop?.[0]) backdrop = '/uploads/' + req.files.backdrop[0].filename;
    const genreIds = req.body.genre_ids ? (Array.isArray(req.body.genre_ids) ? req.body.genre_ids : JSON.parse(req.body.genre_ids)) : null;
    const movieType = (req.body.type === 'series' || req.body.type === 'anime' || req.body.type === 'tvshows') ? req.body.type : (existing.type || 'movie');
    const movieStatus = req.body.status === 'pending' ? 'pending' : (existing.status || 'published');
    const country = req.body.country !== undefined ? (req.body.country || null) : existing.country;
    const titleEn = req.body.title_en !== undefined ? (req.body.title_en || null) : existing.title_en;
    const quality = req.body.quality !== undefined ? (req.body.quality || null) : existing.quality;
    const language = req.body.language !== undefined ? (req.body.language || null) : existing.language;
    const totalEpisodes = req.body.total_episodes !== undefined ? (parseInt(req.body.total_episodes) || 0) : (existing.total_episodes || 0);
    const featured = req.body.featured !== undefined ? (req.body.featured === true || req.body.featured === '1' ? 1 : 0) : (existing.featured || 0);
    const newSlug = req.body.slug !== undefined && String(req.body.slug).trim() ? slugify(String(req.body.slug).trim()) : (existing.slug || null);
    const subtitleUrl = req.body.subtitle_url !== undefined ? (req.body.subtitle_url || null) : (existing.subtitle_url || null);
    db.prepare(`
      UPDATE movies SET title=?, title_en=?, slug=?, description=?, poster=?, backdrop=?, trailer_url=?, video_url=?, subtitle_url=?, duration=?, release_year=?, type=?, status=?, country=?, quality=?, language=?, total_episodes=?, featured=?, updated_at=datetime('now','+7 hours')
      WHERE id=?
    `).run(
      req.body.title ?? existing.title,
      titleEn,
      newSlug,
      req.body.description ?? existing.description,
      poster,
      backdrop,
      req.body.trailer_url ?? existing.trailer_url,
      req.body.video_url ?? existing.video_url,
      subtitleUrl,
      parseInt(req.body.duration) ?? existing.duration,
      (req.body.release_year !== undefined && req.body.release_year !== '' && !Number.isNaN(parseInt(req.body.release_year))) ? parseInt(req.body.release_year) : (existing.release_year ?? null),
      movieType,
      movieStatus,
      country,
      quality,
      language,
      totalEpisodes,
      featured,
      id
    );
    if (genreIds) {
      db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(id);
      const insertGenre = db.prepare('INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)');
      genreIds.forEach((gid) => insertGenre.run(id, parseInt(gid)));
    }
    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
    res.json(movie);
  }
);

router.patch('/movies/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const status = req.body.status === 'pending' ? 'pending' : 'published';
  const existing = db.prepare('SELECT id FROM movies WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy phim' });
  db.prepare("UPDATE movies SET status = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(status, id);
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
  res.json(movie);
});

router.delete('/movies/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const r = db.prepare('DELETE FROM movies WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Không tìm thấy phim' });
  res.json({ deleted: id });
});

// --- Danh sách tập (episodes) theo phim ---
router.get('/movies/:id/episodes', (req, res) => {
  const id = parseInt(req.params.id);
  const movie = db.prepare('SELECT id, title, slug, total_episodes, episodes FROM movies WHERE id = ?').get(id);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  let episodes = [];
  try { episodes = movie.episodes ? JSON.parse(movie.episodes) : []; } catch (_) {}
  if (!Array.isArray(episodes)) episodes = [];
  res.json({ movie_id: movie.id, title: movie.title, slug: movie.slug, total_episodes: movie.total_episodes ?? 0, episodes });
});

router.put('/movies/:id/episodes', (req, res) => {
  const id = parseInt(req.params.id);
  const movie = db.prepare('SELECT id FROM movies WHERE id = ?').get(id);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  const episodes = Array.isArray(req.body.episodes) ? req.body.episodes : [];
  const totalEpisodes = req.body.total_episodes !== undefined ? Math.max(0, parseInt(req.body.total_episodes, 10) || 0) : undefined;
  const normalized = episodes.map((s) => ({
    server_name: s.server_name || 'Nguồn',
    server_data: Array.isArray(s.server_data) ? s.server_data.map((e) => ({
      name: e.name ?? String(e.name),
      slug: e.slug ?? (e.name ? String(e.name).toLowerCase().replace(/\s+/g, '-') : ''),
      link_embed: e.link_embed ?? e.embed ?? '',
      link_m3u8: e.link_m3u8 ?? e.m3u8 ?? '',
    })) : [],
  }));
  const episodesJson = JSON.stringify(normalized);
  if (totalEpisodes !== undefined) {
    db.prepare("UPDATE movies SET episodes = ?, total_episodes = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(episodesJson, totalEpisodes, id);
  } else {
    db.prepare("UPDATE movies SET episodes = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(episodesJson, id);
  }
  const updated = db.prepare('SELECT id, total_episodes, episodes FROM movies WHERE id = ?').get(id);
  let parsed = []; try { parsed = updated.episodes ? JSON.parse(updated.episodes) : []; } catch (_) {}
  res.json({ movie_id: id, total_episodes: updated.total_episodes ?? 0, episodes: parsed });
});

router.post('/movies/:id/episodes', (req, res) => {
  const id = parseInt(req.params.id);
  const movie = db.prepare('SELECT id, episodes FROM movies WHERE id = ?').get(id);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  let episodes = []; try { episodes = movie.episodes ? JSON.parse(movie.episodes) : []; } catch (_) {}
  if (!Array.isArray(episodes)) episodes = [];
  if (req.body.server_name !== undefined) {
    const serverName = String(req.body.server_name || 'Nguồn').trim() || 'Nguồn';
    episodes.push({ server_name: serverName, server_data: [] });
  } else if (req.body.server_index !== undefined && req.body.episode && typeof req.body.episode === 'object') {
    const si = parseInt(req.body.server_index, 10);
    if (si < 0 || si >= episodes.length) return res.status(400).json({ error: 'server_index không hợp lệ' });
    const e = req.body.episode;
    const item = { name: e.name ?? '', slug: e.slug ?? (e.name ? String(e.name).toLowerCase().replace(/\s+/g, '-') : ''), link_embed: e.link_embed ?? e.embed ?? '', link_m3u8: e.link_m3u8 ?? e.m3u8 ?? '' };
    episodes[si].server_data = episodes[si].server_data || [];
    episodes[si].server_data.push(item);
  } else return res.status(400).json({ error: 'Cần server_name hoặc server_index + episode' });
  const episodesJson = JSON.stringify(episodes);
  db.prepare("UPDATE movies SET episodes = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(episodesJson, id);
  const updated = db.prepare('SELECT episodes FROM movies WHERE id = ?').get(id);
  let parsed = []; try { parsed = updated.episodes ? JSON.parse(updated.episodes) : []; } catch (_) {}
  res.json({ movie_id: id, episodes: parsed });
});

router.patch('/movies/:id/episodes', (req, res) => {
  const id = parseInt(req.params.id);
  const movie = db.prepare('SELECT id, episodes FROM movies WHERE id = ?').get(id);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  let episodes = []; try { episodes = movie.episodes ? JSON.parse(movie.episodes) : []; } catch (_) {}
  if (!Array.isArray(episodes)) episodes = [];
  const si = parseInt(req.body.server_index, 10);
  const ei = parseInt(req.body.episode_index, 10);
  if (Number.isNaN(si) || si < 0 || si >= episodes.length) return res.status(400).json({ error: 'server_index không hợp lệ' });
  const serverData = episodes[si].server_data || [];
  if (Number.isNaN(ei) || ei < 0 || ei >= serverData.length) return res.status(400).json({ error: 'episode_index không hợp lệ' });
  const e = req.body.episode || {};
  const current = serverData[ei];
  episodes[si].server_data[ei] = {
    name: e.name !== undefined ? e.name : current.name,
    slug: e.slug !== undefined ? e.slug : (e.name !== undefined ? String(e.name).toLowerCase().replace(/\s+/g, '-') : current.slug),
    link_embed: e.link_embed !== undefined ? e.link_embed : (e.embed !== undefined ? e.embed : current.link_embed),
    link_m3u8: e.link_m3u8 !== undefined ? e.link_m3u8 : (e.m3u8 !== undefined ? e.m3u8 : current.link_m3u8),
  };
  const episodesJson = JSON.stringify(episodes);
  db.prepare("UPDATE movies SET episodes = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(episodesJson, id);
  let parsed = []; try { parsed = JSON.parse(episodesJson); } catch (_) {}
  res.json({ movie_id: id, episodes: parsed });
});

router.delete('/movies/:id/episodes', (req, res) => {
  const id = parseInt(req.params.id);
  const movie = db.prepare('SELECT id, episodes FROM movies WHERE id = ?').get(id);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  let episodes = []; try { episodes = movie.episodes ? JSON.parse(movie.episodes) : []; } catch (_) {}
  if (!Array.isArray(episodes)) episodes = [];
  const si = parseInt(req.body.server_index, 10);
  if (Number.isNaN(si) || si < 0 || si >= episodes.length) return res.status(400).json({ error: 'server_index không hợp lệ' });
  const ei = req.body.episode_index;
  if (ei === undefined || ei === null) {
    episodes.splice(si, 1);
  } else {
    const epIdx = parseInt(ei, 10);
    const serverData = episodes[si].server_data || [];
    if (Number.isNaN(epIdx) || epIdx < 0 || epIdx >= serverData.length) return res.status(400).json({ error: 'episode_index không hợp lệ' });
    episodes[si].server_data.splice(epIdx, 1);
    if (episodes[si].server_data.length === 0) episodes.splice(si, 1);
  }
  const episodesJson = JSON.stringify(episodes);
  db.prepare("UPDATE movies SET episodes = ?, updated_at = datetime('now','+7 hours') WHERE id = ?").run(episodesJson, id);
  let parsed = []; try { parsed = JSON.parse(episodesJson); } catch (_) {}
  res.json({ movie_id: id, episodes: parsed });
});

// Helper: đảm bảo thể loại có trong DB, trả về id (tự thêm nếu chưa có).
// Slug chuẩn hóa bằng slugify() để "Nhật Bản" / "Nhat Ban" cùng trỏ về một bản ghi, tránh trùng.
function ensureGenre(db, name, slug, genreBySlug, genreByName) {
  const n = String(name || slug || '').trim();
  if (!n) return null;
  const slugFinal = slugify(n) || n.toLowerCase().replace(/\s+/g, '-');
  const keyName = n.toLowerCase();
  if (genreBySlug.has(slugFinal)) return genreBySlug.get(slugFinal);
  if (genreByName.has(keyName)) return genreByName.get(keyName);
  db.prepare('INSERT OR IGNORE INTO genres (name, slug) VALUES (?, ?)').run(n, slugFinal);
  const row = db.prepare('SELECT id FROM genres WHERE slug = ?').get(slugFinal) || db.prepare('SELECT id FROM genres WHERE name = ?').get(n);
  if (!row) return null;
  genreBySlug.set(slugFinal, row.id);
  genreByName.set(keyName, row.id);
  return row.id;
}

// Helper: đảm bảo quốc gia có trong DB (tự thêm nếu chưa có).
// Slug chuẩn hóa bằng slugify() và map countryBySlug để "Nhật Bản" / "Nhat Ban" không tạo hai bản ghi.
function ensureCountry(db, name, countryBySlug) {
  if (!name || typeof name !== 'string') return;
  const n = name.trim();
  if (!n) return;
  const slug = slugify(n) || n.toLowerCase().replace(/\s+/g, '-');
  if (countryBySlug && countryBySlug.has(slug)) return;
  db.prepare('INSERT OR IGNORE INTO countries (name, slug) VALUES (?, ?)').run(n, slug);
  if (countryBySlug) countryBySlug.set(slug, true);
}

// Helper: đảm bảo năm phát hành có trong DB (tự thêm nếu chưa có)
function ensureReleaseYear(db, year) {
  if (year == null || Number.isNaN(Number(year))) return;
  const y = String(parseInt(year, 10));
  if (!y) return;
  db.prepare('INSERT OR IGNORE INTO release_years (name, slug) VALUES (?, ?)').run(y, y);
}

// Helper: đảm bảo đạo diễn có trong DB; slug dùng NFD để khớp link frontend (Hồng → hong)
// extra: { avatar?, biography?, tmdb_id? }
// Nếu slug trùng với đạo diễn khác thì dùng INSERT OR IGNORE và lấy id theo slug để tránh UNIQUE constraint.
function ensureDirector(db, name, avatarUrl = null, extra = {}) {
  if (!name || typeof name !== 'string') return;
  const n = name.trim();
  if (!n) return;
  const slug = slugify(n) || n.toLowerCase().replace(/\s+/g, '-');
  const avatar = extra.avatar ?? avatarUrl;
  const biography = extra.biography ?? null;
  const tmdbId = extra.tmdb_id ?? null;
  const existing = db.prepare('SELECT id, slug FROM directors WHERE name = ?').get(n);
  if (existing) {
    if (existing.slug !== slug) db.prepare('UPDATE directors SET slug = ? WHERE id = ?').run(slug, existing.id);
    if (avatar && typeof avatar === 'string' && avatar.startsWith('http')) {
      db.prepare('UPDATE directors SET avatar = ? WHERE id = ?').run(avatar.trim(), existing.id);
    }
    if (biography != null) db.prepare('UPDATE directors SET biography = ? WHERE id = ?').run(biography, existing.id);
    if (tmdbId != null) db.prepare('UPDATE directors SET tmdb_id = ? WHERE id = ?').run(tmdbId, existing.id);
  } else {
    const bySlug = db.prepare('SELECT id FROM directors WHERE slug = ?').get(slug);
    if (bySlug) return;
    db.prepare('INSERT OR IGNORE INTO directors (name, slug) VALUES (?, ?)').run(n, slug);
    const id = db.prepare('SELECT id FROM directors WHERE slug = ?').get(slug)?.id;
    if (id) {
      if (avatar && typeof avatar === 'string' && avatar.startsWith('http')) {
        db.prepare('UPDATE directors SET avatar = ? WHERE id = ?').run(avatar.trim(), id);
      }
      if (biography != null) db.prepare('UPDATE directors SET biography = ? WHERE id = ?').run(biography, id);
      if (tmdbId != null) db.prepare('UPDATE directors SET tmdb_id = ? WHERE id = ?').run(tmdbId, id);
    }
  }
}

// Helper: đảm bảo diễn viên có trong DB; slug dùng NFD để khớp link frontend (Hồng → hong)
// extra: { avatar?, biography?, tmdb_id? }
// Nếu slug trùng với diễn viên khác (khác tên), dùng INSERT OR IGNORE rồi lấy id theo slug để tránh UNIQUE constraint.
function ensureActor(db, name, avatarUrl = null, extra = {}) {
  if (!name || typeof name !== 'string') return;
  const n = name.trim();
  if (!n) return;
  const slug = slugify(n) || n.toLowerCase().replace(/\s+/g, '-');
  const avatar = extra.avatar ?? avatarUrl;
  const biography = extra.biography ?? null;
  const tmdbId = extra.tmdb_id ?? null;
  const otherNames = extra.other_names ?? null;
  const gender = extra.gender ?? null;
  const birthday = extra.birthday ?? null;
  const placeOfBirth = extra.place_of_birth ?? null;
  const existing = db.prepare('SELECT id, slug FROM actors WHERE name = ?').get(n);
  const updateField = (col, val) => {
    if (val != null) db.prepare(`UPDATE actors SET ${col} = ? WHERE id = ?`).run(val, existing.id);
  };
  if (existing) {
    if (existing.slug !== slug) db.prepare('UPDATE actors SET slug = ? WHERE id = ?').run(slug, existing.id);
    if (avatar && typeof avatar === 'string' && avatar.startsWith('http')) {
      db.prepare('UPDATE actors SET avatar = ? WHERE id = ?').run(avatar.trim(), existing.id);
    }
    if (biography != null) db.prepare('UPDATE actors SET biography = ? WHERE id = ?').run(biography, existing.id);
    if (tmdbId != null) db.prepare('UPDATE actors SET tmdb_id = ? WHERE id = ?').run(tmdbId, existing.id);
    updateField('other_names', otherNames);
    updateField('gender', gender);
    updateField('birthday', birthday);
    updateField('place_of_birth', placeOfBirth);
  } else {
    const bySlug = db.prepare('SELECT id FROM actors WHERE slug = ?').get(slug);
    if (bySlug) {
      const id = bySlug.id;
      if (avatar && typeof avatar === 'string' && avatar.startsWith('http')) db.prepare('UPDATE actors SET avatar = ? WHERE id = ?').run(avatar.trim(), id);
      if (biography != null) db.prepare('UPDATE actors SET biography = ? WHERE id = ?').run(biography, id);
      if (tmdbId != null) db.prepare('UPDATE actors SET tmdb_id = ? WHERE id = ?').run(tmdbId, id);
      if (otherNames != null) db.prepare('UPDATE actors SET other_names = ? WHERE id = ?').run(otherNames, id);
      if (gender != null) db.prepare('UPDATE actors SET gender = ? WHERE id = ?').run(gender, id);
      if (birthday != null) db.prepare('UPDATE actors SET birthday = ? WHERE id = ?').run(birthday, id);
      if (placeOfBirth != null) db.prepare('UPDATE actors SET place_of_birth = ? WHERE id = ?').run(placeOfBirth, id);
      return;
    }
    db.prepare('INSERT OR IGNORE INTO actors (name, slug) VALUES (?, ?)').run(n, slug);
    const id = db.prepare('SELECT id FROM actors WHERE slug = ?').get(slug)?.id;
    if (id) {
      if (avatar && typeof avatar === 'string' && avatar.startsWith('http')) {
        db.prepare('UPDATE actors SET avatar = ? WHERE id = ?').run(avatar.trim(), id);
      }
      if (biography != null) db.prepare('UPDATE actors SET biography = ? WHERE id = ?').run(biography, id);
      if (tmdbId != null) db.prepare('UPDATE actors SET tmdb_id = ? WHERE id = ?').run(tmdbId, id);
      if (otherNames != null) db.prepare('UPDATE actors SET other_names = ? WHERE id = ?').run(otherNames, id);
      if (gender != null) db.prepare('UPDATE actors SET gender = ? WHERE id = ?').run(gender, id);
      if (birthday != null) db.prepare('UPDATE actors SET birthday = ? WHERE id = ?').run(birthday, id);
      if (placeOfBirth != null) db.prepare('UPDATE actors SET place_of_birth = ? WHERE id = ?').run(placeOfBirth, id);
    }
  }
}

// Helper: import một phim theo slug vào DB (dùng cho crawl/import và crawl/run).
// opts: { excludeGenres?: string[], excludeCountries?: string[] } — khi có, nếu phim thuộc thể loại/quốc gia trong list thì bỏ qua (không lưu).
async function importMovieBySlug(slug, opts = {}) {
  const crawled = await getMovieBySlug(slug);
  if (!crawled) return { ok: false, error: 'Không tìm thấy phim' };

  const exclGenres = Array.isArray(opts.excludeGenres) ? opts.excludeGenres.map((s) => String(s).trim().toLowerCase()).filter(Boolean) : [];
  const exclCountries = Array.isArray(opts.excludeCountries) ? opts.excludeCountries.map((s) => String(s).trim().toLowerCase()).filter(Boolean) : [];
  if (exclGenres.length || exclCountries.length) {
    const norm = (v) => (v == null || v === '') ? '' : slugify(String(v)).toLowerCase();
    const movieGenreSlugs = (crawled.genres || []).map((g) => norm(g?.slug || g?.name || g)).filter(Boolean);
    const movieCountrySlugs = [
      ...(crawled.countries || []).map((c) => norm(typeof c === 'object' ? (c?.slug || c?.name) : c)),
      crawled.country ? norm(crawled.country) : '',
    ].filter(Boolean);
    if (exclGenres.length && movieGenreSlugs.some((s) => exclGenres.includes(s))) return { ok: false, skipped: true, reason: 'excluded_genre' };
    if (exclCountries.length && movieCountrySlugs.some((s) => exclCountries.includes(s))) return { ok: false, skipped: true, reason: 'excluded_country' };
  }

  const genreRows = db.prepare('SELECT id, name, slug FROM genres').all();
  const genreBySlug = new Map();
  const genreByName = new Map();
  for (const g of genreRows) {
    const slugNorm = slugify(g.slug || '') || slugify(g.name || '');
    const nameNorm = String(g.name || '').toLowerCase().trim();
    if (slugNorm) genreBySlug.set(slugNorm, g.id);
    if (nameNorm) genreByName.set(nameNorm, g.id);
  }

  const genreIds = [];
  for (const g of crawled.genres || []) {
    const name = g?.name || g;
    const slugGen = g?.slug || name;
    const id = ensureGenre(db, name, slugGen, genreBySlug, genreByName);
    if (id) genreIds.push(id);
  }
  const genreIdsUnique = [...new Set(genreIds)];

  const countryRows = db.prepare('SELECT id, name, slug FROM countries').all();
  const countryBySlug = new Map();
  for (const c of countryRows) {
    const slugNorm = slugify(c.slug || '') || slugify(c.name || '');
    if (slugNorm) countryBySlug.set(slugNorm, true);
  }
  const country = crawled.country && typeof crawled.country === 'string' ? crawled.country : (crawled.countries?.[0]?.name || null);
  if (country) ensureCountry(db, country, countryBySlug);

  const releaseYear = crawled.release_year ? parseInt(crawled.release_year, 10) : null;
  if (releaseYear) ensureReleaseYear(db, releaseYear);

  let directorStr = crawled.director && typeof crawled.director === 'string' ? crawled.director.trim() : '';
  let castArr = Array.isArray(crawled.cast)
    ? crawled.cast.map((c) => {
        const name = (typeof c === 'object' && c && c.name != null ? String(c.name) : String(c)).trim();
        const id = typeof c === 'object' && c && c.id != null && !Number.isNaN(Number(c.id)) ? Number(c.id) : null;
        return name ? (id != null ? { id, name } : { name }) : null;
      }).filter(Boolean)
    : [];

  const movieType = (crawled.type === 'series' || crawled.type === 'anime' || crawled.type === 'tvshows') ? crawled.type : 'movie';
  let tmdbId = crawled.tmdb_id && (Number(crawled.tmdb_id) || String(crawled.tmdb_id));
  let creditsType = (movieType === 'tvshows' || movieType === 'series') ? 'tv' : 'movie';
  // TMDB: dùng tmdb_id từ KKPhim (PhimAPI) hoặc tìm theo tên phim để lấy credits (đạo diễn + diễn viên có id)
  if (!tmdbId && process.env.TMDB_API_KEY && crawled.title) {
    const found = await searchTmdbByTitle(crawled.title, crawled.release_year, movieType);
    if (found && found.id) {
      tmdbId = found.id;
      creditsType = found.type === 'tv' ? 'tv' : 'movie';
    }
  }
  if (tmdbId && process.env.TMDB_API_KEY) {
    const credits = await fetchTmdbCredits(tmdbId, creditsType);
    const parsed = parseTmdbCredits(credits);
    const maxDirectors = 5;
    const maxCast = 15;
    if (parsed.directors.length) {
      directorStr = parsed.directors.map((d) => d.name).join(', ');
      const directorsToFetch = parsed.directors.filter((d) => d.id).slice(0, maxDirectors);
      const directorInfos = await Promise.all(
        directorsToFetch.map((d) => fetchTmdbPersonWithAvatar(d.id).then((p) => (p ? { ...p, tmdb_id: d.id } : null)))
      );
      for (let i = 0; i < parsed.directors.length; i++) {
        const d = parsed.directors[i];
        const enriched = directorInfos.find((p) => p && p.name === d.name);
        const extra = enriched
          ? { avatar: enriched.avatar, biography: enriched.biography, tmdb_id: enriched.tmdb_id }
          : { avatar: d.avatar };
        ensureDirector(db, d.name, d.avatar, extra);
      }
    }
    if (parsed.cast.length) {
      castArr = parsed.cast.map((c) => (c.id ? { id: c.id, name: c.name } : { name: c.name }));
      const castToFetch = parsed.cast.filter((c) => c.id).slice(0, maxCast);
      const castInfos = await Promise.all(
        castToFetch.map((c) => fetchTmdbPersonWithAvatar(c.id).then((p) => (p ? { ...p, tmdb_id: c.id } : null)))
      );
      for (const c of parsed.cast) {
        const enriched = castInfos.find((p) => p && p.name === c.name);
        const extra = enriched
          ? { avatar: enriched.avatar, biography: enriched.biography, tmdb_id: enriched.tmdb_id }
          : { avatar: c.avatar };
        ensureActor(db, c.name, c.avatar, extra);
      }
    }
  }

  const directorFinal = directorStr || null;
  castArr.forEach((c) => ensureActor(db, c.name, null, c.id != null ? { tmdb_id: c.id } : undefined));
  if (directorFinal) directorFinal.split(',').map((s) => s.trim()).filter(Boolean).forEach((d) => ensureDirector(db, d));
  const castJson = JSON.stringify(castArr);

  const title = crawled.title || slug;
  const titleEn = crawled.title_en || null;
  let description = (crawled.description || '').trim();
  // AI tự động viết lại/dịch mô tả phim (tắt khi hết quota: đặt ENABLE_AI_REWRITE_ON_CRAWL=0 trong .env)
  const allowAiRewrite = process.env.ENABLE_AI_REWRITE_ON_CRAWL !== '0' && process.env.ENABLE_AI_REWRITE_ON_CRAWL !== 'false';
  if (description && allowAiRewrite && (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)) {
    try {
      const rewritten = await Promise.race([
        rewriteMovieDescription(description, title),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]);
      if (rewritten && typeof rewritten === 'string' && rewritten.trim()) description = rewritten.trim();
    } catch (e) {
      if (e.message !== 'timeout') console.error('AI rewrite description:', e.message);
    }
  }
  const poster = sanitizeImageUrl(crawled.poster) || '';
  const backdrop = sanitizeImageUrl(crawled.backdrop) || poster || '';
  const thumbnail = sanitizeImageUrl(crawled.thumbnail) || poster || '';
  const trailerUrl = crawled.trailer_url || '';
  const videoUrl = crawled.video_url || '';
  const quality = crawled.quality || null;
  const language = crawled.language || null;
  const totalEpisodes = parseInt(crawled.total_episodes, 10) || 0;
  const episodeCurrent = crawled.episode_current != null ? Math.max(0, parseInt(crawled.episode_current, 10) || 0) : null;
  const duration = crawled.duration != null ? Math.max(0, parseInt(crawled.duration, 10) || 0) : 0;
  const source = (crawled.source === 'phimapi' || crawled.source === 'ophim') ? crawled.source : null;
  const chieuRapVal = crawled.chieu_rap ?? crawled.chieuRap ?? crawled.chieurap;
  const chieuRap = (chieuRapVal === true || chieuRapVal === 1 || String(chieuRapVal).toLowerCase().trim() === 'true' || String(chieuRapVal).trim() === '1') ? 1 : 0;
  const thuyetMinh = (crawled.thuyet_minh === true || crawled.thuyet_minh === 1) ? 1 : 0;
  const episodesJson = Array.isArray(crawled.episodes) && crawled.episodes.length > 0
    ? JSON.stringify(crawled.episodes)
    : null;

  const seriesFromSlug = parseSeriesFromSlug(slug);
  const seriesKey = seriesFromSlug ? seriesFromSlug.series_key : null;
  const partNumber = seriesFromSlug ? seriesFromSlug.part_number : 1;

  const movieStatus = (crawled.status === 'trailer') ? 'trailer' : 'published';

  const existing = db.prepare('SELECT id FROM movies WHERE slug = ?').get(slug);
  if (existing) {
    db.prepare(`
      UPDATE movies SET title=?, title_en=?, description=?, poster=?, backdrop=?, thumbnail=?, trailer_url=?, video_url=?,
        duration=?, release_year=?, type=?, status=?, country=?, quality=?, language=?, total_episodes=?, episode_current=?, director=?, cast=?, source=?, series_key=?, part_number=?, episodes=?, chieu_rap=?, thuyet_minh=?, updated_at=datetime('now','+7 hours')
      WHERE id=?
    `).run(title, titleEn, description, poster, backdrop, thumbnail, trailerUrl, videoUrl, duration, releaseYear, movieType, movieStatus, country, quality, language, totalEpisodes, episodeCurrent, directorFinal, castJson, source, seriesKey, partNumber, episodesJson, chieuRap, thuyetMinh, existing.id);
    db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(existing.id);
    const insertGenre = db.prepare('INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)');
    genreIdsUnique.forEach((gid) => insertGenre.run(existing.id, gid));
    return { ok: true, updated: true, movieId: existing.id };
  }
  const r = db.prepare(`
    INSERT INTO movies (title, title_en, slug, description, poster, backdrop, thumbnail, trailer_url, video_url, duration, release_year, type, status, country, quality, language, total_episodes, episode_current, director, cast, source, series_key, part_number, episodes, chieu_rap, thuyet_minh)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, titleEn, slug, description, poster, backdrop, thumbnail, trailerUrl, videoUrl, duration, releaseYear, movieType, movieStatus, country, quality, language, totalEpisodes, episodeCurrent, directorFinal, castJson, source, seriesKey, partNumber, episodesJson, chieuRap, thuyetMinh);
  const insertGenre = db.prepare('INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)');
  genreIdsUnique.forEach((gid) => insertGenre.run(r.lastInsertRowid, gid));
  return { ok: true, created: true, movieId: r.lastInsertRowid };
}

// Crawl import: lấy phim từ nguồn KKPhim (PhimAPI) rồi ghi vào DB
router.post('/crawl/import', async (req, res) => {
  const slug = (req.body.slug || (req.query.slug || '').trim()).trim();
  if (!slug) {
    return res.status(400).json({ error: 'Thiếu slug phim cần import' });
  }
  try {
    const result = await importMovieBySlug(slug);
    if (!result.ok) {
      crawlLogger.logWarn(`Import ${slug}: ${result.error}`, { slug });
      return res.status(404).json({ error: result.error || 'Không tìm thấy phim' });
    }
    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(result.movieId);
    if (result.created) crawlLogger.logInfo(`Import thêm mới: ${slug}`, { slug });
    else crawlLogger.logInfo(`Import cập nhật: ${slug}`, { slug });
    return res.status(result.created ? 201 : 200).json({
      created: !!result.created,
      updated: !!result.updated,
      movie,
    });
  } catch (err) {
    console.error(err);
    crawlLogger.logError(`Import lỗi ${slug}: ${err.message}`, { slug });
    res.status(500).json({ error: err.message || 'Lỗi khi import phim' });
  }
});

// Chạy crawl theo trang + lọc thể loại/quốc gia — ưu tiên KKPhim (phimapi) trước, sau đó Ophim
// API phim-moi-cap-nhat có thể có 1100+ trang (26k+ phim) — cần đủ để "crawl đến hết trang"
const CRAWL_MAX_PAGES = 30000;
const SOURCES = ['phimapi', 'ophim'];

function getCrawlAutoSettings() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'crawl_%'").all();
  const o = {};
  rows.forEach((r) => { o[r.key] = r.value; });
  return {
    enabled: o.crawl_auto_enabled === '1',
    interval_minutes: Math.max(5, parseInt(o.crawl_auto_interval_minutes, 10) || 30),
    sources: (o.crawl_auto_sources && JSON.parse(o.crawl_auto_sources)) || SOURCES,
    page_from: Math.max(1, parseInt(o.crawl_auto_page_from, 10) || 1),
    page_to: Math.max(1, Math.min(CRAWL_MAX_PAGES, parseInt(o.crawl_auto_page_to, 10) || 1)),
    crawl_to_end: o.crawl_auto_to_end === '1',
    exclude_genres: parseJsonArray(o.crawl_auto_exclude_genres),
    exclude_countries: parseJsonArray(o.crawl_auto_exclude_countries),
    actors_sync_enabled: o.crawl_actors_sync_enabled === '1',
    actors_sync_interval_minutes: Math.max(60, parseInt(o.crawl_actors_sync_interval_minutes, 10) || 360),
  };
}
function parseJsonArray(str) {
  if (!str || typeof str !== 'string') return [];
  try {
    const a = JSON.parse(str);
    return Array.isArray(a) ? a.filter((x) => x != null && String(x).trim()) : [];
  } catch {
    return [];
  }
}

function setCrawlAutoSettings(data) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  if (data.enabled !== undefined) stmt.run('crawl_auto_enabled', data.enabled ? '1' : '0');
  if (data.interval_minutes !== undefined) stmt.run('crawl_auto_interval_minutes', String(data.interval_minutes));
  if (data.sources !== undefined) stmt.run('crawl_auto_sources', JSON.stringify(Array.isArray(data.sources) ? data.sources : SOURCES));
  if (data.page_from !== undefined) stmt.run('crawl_auto_page_from', String(data.page_from));
  if (data.page_to !== undefined) stmt.run('crawl_auto_page_to', String(data.page_to));
  if (data.crawl_to_end !== undefined) stmt.run('crawl_auto_to_end', data.crawl_to_end ? '1' : '0');
  if (data.exclude_genres !== undefined) stmt.run('crawl_auto_exclude_genres', JSON.stringify(Array.isArray(data.exclude_genres) ? data.exclude_genres : []));
  if (data.exclude_countries !== undefined) stmt.run('crawl_auto_exclude_countries', JSON.stringify(Array.isArray(data.exclude_countries) ? data.exclude_countries : []));
  if (data.actors_sync_enabled !== undefined) stmt.run('crawl_actors_sync_enabled', data.actors_sync_enabled ? '1' : '0');
  if (data.actors_sync_interval_minutes !== undefined) stmt.run('crawl_actors_sync_interval_minutes', String(Math.max(60, parseInt(data.actors_sync_interval_minutes, 10) || 360)));
}

router.get('/crawl/auto-settings', (req, res) => {
  res.json(getCrawlAutoSettings());
});

router.get('/crawl/logs', (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
  const entries = crawlLogger.getEntries(limit);
  res.json({ logs: entries });
});

// Chạy job crawl (dùng cho POST /crawl/run và auto-crawl). excludeGenres/excludeCountries: bỏ qua phim thuộc các thể loại/quốc gia đã chọn.
export async function runCrawlJob(sources, pageFrom, pageTo, excludeGenres, excludeCountries, crawlToEnd = false) {
  const src = Array.isArray(sources) ? sources.filter((s) => SOURCES.includes(s)) : [...SOURCES];
  let pFrom = Math.max(1, parseInt(pageFrom, 10) || 1);
  let pTo = crawlToEnd ? CRAWL_MAX_PAGES : Math.max(1, Math.min(CRAWL_MAX_PAGES, parseInt(pageTo, 10) || 1));
  if (!crawlToEnd && pTo < pFrom) pTo = pFrom;

  // Khi "crawl đến hết trang": lấy totalPages từ API (trang 1) để crawl đủ theo pagination thực tế (vd. 1103 trang)
  if (crawlToEnd && src.length > 0) {
    try {
      const first = await getHome(src[0], 1);
      const totalPages = first?.pagination?.totalPages;
      if (typeof totalPages === 'number' && totalPages >= 1) {
        pTo = Math.min(CRAWL_MAX_PAGES, totalPages);
        crawlLogger.logInfo(`Crawl đến hết trang: API báo ${totalPages} trang — sẽ crawl trang 1–${pTo}`, { totalPages, pTo });
      }
    } catch (e) {
      console.error('[Crawl] Lấy totalPages trang 1:', e?.message);
    }
  }

  const exclGenres = Array.isArray(excludeGenres) ? excludeGenres.map((s) => String(s).trim().toLowerCase()).filter(Boolean) : [];
  const exclCountries = Array.isArray(excludeCountries) ? excludeCountries.map((s) => String(s).trim().toLowerCase()).filter(Boolean) : [];

  crawlLogger.logInfo(`Crawl bắt đầu — nguồn: ${src.join(', ')}${crawlToEnd ? `, crawl đến hết trang (1–${pTo})` : `, trang ${pFrom}–${pTo}`}${exclGenres.length ? `, bỏ qua thể loại: ${exclGenres.join(', ')}` : ''}${exclCountries.length ? `, bỏ qua quốc gia: ${exclCountries.join(', ')}` : ''}`, { sources: src, pageFrom: pFrom, pageTo: crawlToEnd ? pTo : pTo });

  function toSlugLower(val) {
    if (val == null || val === '') return '';
    const s = slugify(String(val));
    return s ? s.toLowerCase() : '';
  }
  function getGenreSlugsFromItem(it) {
    const raw = it.category || it.categories || it.the_loai || it.genre || it.genres;
    const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return arr.map((c) => (typeof c === 'object' && c ? (c.slug ? toSlugLower(c.slug) : toSlugLower(c.name || '')) : toSlugLower(c))).filter(Boolean);
  }
  function getCountrySlugsFromItem(it) {
    const raw = it.country || it.countries || it.quoc_gia;
    const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return arr.map((c) => (typeof c === 'object' && c ? (c.slug ? toSlugLower(c.slug) : toSlugLower(c.name || '')) : toSlugLower(c))).filter(Boolean);
  }

  const slugSet = new Set();
  for (const source of src) {
    for (let p = pFrom; p <= pTo; p++) {
      try {
        const homeData = await getHome(source, p);
        const items = homeData?.items ?? [];
        if (crawlToEnd && items.length === 0) break;
        for (const it of items) {
          const slug = it?.slug;
          if (!slug || typeof slug !== 'string') continue;
          if (exclGenres.length) {
            const itemSlugs = getGenreSlugsFromItem(it);
            if (itemSlugs.length > 0 && itemSlugs.some((s) => exclGenres.includes(s))) continue;
          }
          if (exclCountries.length) {
            const itemCountrySlugs = getCountrySlugsFromItem(it);
            if (itemCountrySlugs.length > 0 && itemCountrySlugs.some((s) => exclCountries.includes(s))) continue;
          }
          slugSet.add(slug);
        }
      } catch (e) {
        const errMsg = e?.message ?? String(e);
        console.error('Crawl fetch error', source, p, e);
        crawlLogger.logError(`Lấy danh sách thất bại: ${source} trang ${p} — ${errMsg}`, { source, page: p });
        if (crawlToEnd) break;
      }
    }
  }

  const slugs = [...slugSet];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const failed = [];
  const importOpts = (exclGenres.length || exclCountries.length) ? { excludeGenres: exclGenres, excludeCountries: exclCountries } : {};
  for (const slug of slugs) {
    try {
      const result = await importMovieBySlug(slug, importOpts);
      if (result.skipped) skipped++;
      else if (result.created) created++;
      else if (result.updated) updated++;
    } catch (e) {
      const errMsg = e?.message ?? String(e);
      failed.push({ slug, error: errMsg });
      crawlLogger.logError(`Crawl lỗi: ${slug} — ${errMsg}`, { slug });
    }
  }
  crawlLogger.logInfo(`Crawl xong — ${slugs.length} slug, thêm mới: ${created}, cập nhật: ${updated}, bỏ qua (lọc): ${skipped}, lỗi: ${failed.length}`, { total: slugs.length, created, updated, skipped, failed: failed.length });
  return { total: slugs.length, created, updated, skipped, failed: failed.length, failed_list: failed.slice(0, 20) };
}

let autoCrawlTimerId = null;

export function startAutoCrawlTimer() {
  if (autoCrawlTimerId) clearInterval(autoCrawlTimerId);
  autoCrawlTimerId = null;
  let s;
  try {
    s = getCrawlAutoSettings();
  } catch (e) {
    console.error('[AutoCrawl] Lỗi đọc cấu hình:', e?.message);
    return;
  }
  if (!s.enabled) {
    console.log('[AutoCrawl] Chưa bật. Vào Admin > Crawl > bật "Bật auto crawl" và bấm "Lưu cấu hình auto".');
    return;
  }
  const ms = s.interval_minutes * 60 * 1000;
  autoCrawlTimerId = setInterval(() => {
    const cfg = getCrawlAutoSettings();
    if (!cfg.enabled) return;
    runCrawlJob(cfg.sources, cfg.page_from, cfg.page_to, cfg.exclude_genres, cfg.exclude_countries, cfg.crawl_to_end)
      .then((r) => console.log('[AutoCrawl]', r.total, 'slugs, created:', r.created, 'updated:', r.updated, 'failed:', r.failed))
      .catch((e) => console.error('[AutoCrawl]', e));
  }, ms);
  console.log('[AutoCrawl] Started, interval:', s.interval_minutes, 'min');
}

let autoActorsSyncTimerId = null;
const ACTORS_SYNC_LIMIT = 500;

export function startAutoActorsSyncTimer() {
  if (autoActorsSyncTimerId) clearInterval(autoActorsSyncTimerId);
  autoActorsSyncTimerId = null;
  let s;
  try {
    s = getCrawlAutoSettings();
  } catch (e) {
    console.error('[AutoActorsSync] Lỗi đọc cấu hình:', e?.message);
    return;
  }
  if (!s.actors_sync_enabled) {
    console.log('[AutoActorsSync] Chưa bật. Vào Admin > Crawl > bật "Auto đồng bộ diễn viên TMDB" và bấm "Lưu cấu hình auto".');
    return;
  }
  const ms = s.actors_sync_interval_minutes * 60 * 1000;
  autoActorsSyncTimerId = setInterval(() => {
    const cfg = getCrawlAutoSettings();
    if (!cfg.actors_sync_enabled) return;
    import('../services/syncActorsFromTmdb.js').then(({ syncActorsFromTmdb }) => syncActorsFromTmdb(ACTORS_SYNC_LIMIT))
      .then((r) => console.log('[AutoActorsSync]', r?.updated ?? 0, 'updated, errors:', r?.errors ?? 0))
      .catch((e) => console.error('[AutoActorsSync]', e?.message ?? e));
  }, ms);
  console.log('[AutoActorsSync] Started, interval:', s.actors_sync_interval_minutes, 'min');
}

// POST /admin/crawl/run — crawl từ trang X đến Y (hoặc đến hết nếu crawl_to_end=true)
router.post('/crawl/run', async (req, res) => {
  const body = req.body || {};
  const sources = Array.isArray(body.sources) ? body.sources.filter((s) => SOURCES.includes(s)) : [...SOURCES];
  let pageFrom = Math.max(1, parseInt(body.page_from, 10) || 1);
  let pageTo = Math.max(1, Math.min(CRAWL_MAX_PAGES, parseInt(body.page_to, 10) || 1));
  if (pageTo < pageFrom) pageTo = pageFrom;
  const crawlToEnd = body.crawl_to_end === true || body.crawl_to_end === '1';
  const excludeGenres = Array.isArray(body.exclude_genres) ? body.exclude_genres : [];
  const excludeCountries = Array.isArray(body.exclude_countries) ? body.exclude_countries : [];
  try {
    const result = await runCrawlJob(sources, pageFrom, pageTo, excludeGenres, excludeCountries, crawlToEnd);
    res.json(result);
  } catch (err) {
    const errMsg = err?.message ?? String(err);
    console.error('[Crawl run]', errMsg, err?.stack);
    crawlLogger.logError(`Crawl run lỗi: ${errMsg}`, { error: errMsg });
    res.status(500).json({ error: errMsg || 'Lỗi khi crawl', stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined });
  }
});

// Bật/tắt auto-crawl: khi PUT bật thì khởi động timer
router.put('/crawl/auto-settings', (req, res) => {
  setCrawlAutoSettings(req.body || {});
  startAutoCrawlTimer();
  startAutoActorsSyncTimer();
  res.json(getCrawlAutoSettings());
});

// Genres CRUD (optional)
router.get('/genres', (req, res) => {
  res.json(db.prepare('SELECT id, name, slug FROM genres ORDER BY name').all());
});

router.post('/genres', [body('name').trim().notEmpty()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const slug = slugify(req.body.name);
  const r = db.prepare('INSERT INTO genres (name, slug) VALUES (?, ?)').run(req.body.name, slug);
  res.status(201).json(db.prepare('SELECT * FROM genres WHERE id = ?').get(r.lastInsertRowid));
});
router.post('/genres/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Thiếu danh sách id thể loại cần xóa' });
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM movie_genres WHERE genre_id IN (${placeholders})`).run(...ids);
  const r = db.prepare(`DELETE FROM genres WHERE id IN (${placeholders})`).run(...ids);
  res.json({ deleted: r.changes });
});
router.post('/genres/delete-all', (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Cần gửi confirm: true để xóa toàn bộ thể loại' });
  db.prepare('DELETE FROM movie_genres').run();
  const r = db.prepare('DELETE FROM genres').run();
  res.json({ deleted: r.changes });
});

// Countries CRUD (quốc gia)
router.get('/countries', (req, res) => {
  res.json(db.prepare('SELECT id, name, slug FROM countries ORDER BY name').all());
});

router.post('/countries', [body('name').trim().notEmpty()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const slug = slugify(req.body.name);
  const r = db.prepare('INSERT INTO countries (name, slug) VALUES (?, ?)').run(req.body.name, slug);
  res.status(201).json(db.prepare('SELECT * FROM countries WHERE id = ?').get(r.lastInsertRowid));
});
router.post('/countries/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Thiếu danh sách id quốc gia cần xóa' });
  const placeholders = ids.map(() => '?').join(',');
  const r = db.prepare(`DELETE FROM countries WHERE id IN (${placeholders})`).run(...ids);
  res.json({ deleted: r.changes });
});
router.post('/countries/delete-all', (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Cần gửi confirm: true để xóa toàn bộ quốc gia' });
  const r = db.prepare('DELETE FROM countries').run();
  res.json({ deleted: r.changes });
});

// Directors CRUD (đạo diễn; avatar từ TMDB nếu có)
router.get('/directors', (req, res) => {
  res.json(db.prepare('SELECT id, name, slug, avatar, biography, tmdb_id FROM directors ORDER BY name').all());
});
router.post('/directors', [body('name').trim().notEmpty()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const slug = slugify(req.body.name);
  const r = db.prepare('INSERT INTO directors (name, slug) VALUES (?, ?)').run(req.body.name, slug);
  res.status(201).json(db.prepare('SELECT * FROM directors WHERE id = ?').get(r.lastInsertRowid));
});
router.post('/directors/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Thiếu danh sách id đạo diễn cần xóa' });
  const placeholders = ids.map(() => '?').join(',');
  const r = db.prepare(`DELETE FROM directors WHERE id IN (${placeholders})`).run(...ids);
  res.json({ deleted: r.changes });
});
router.post('/directors/delete-all', (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Cần gửi confirm: true để xóa toàn bộ đạo diễn' });
  const r = db.prepare('DELETE FROM directors').run();
  res.json({ deleted: r.changes });
});

// Actors CRUD (diễn viên; avatar từ TMDB nếu có)
router.get('/actors', (req, res) => {
  res.json(db.prepare('SELECT id, name, slug, avatar, biography, tmdb_id, other_names, gender, birthday, place_of_birth FROM actors ORDER BY name').all());
});
router.post('/actors', [body('name').trim().notEmpty()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const slug = slugify(req.body.name);
  const r = db.prepare('INSERT INTO actors (name, slug) VALUES (?, ?)').run(req.body.name, slug);
  res.status(201).json(db.prepare('SELECT * FROM actors WHERE id = ?').get(r.lastInsertRowid));
});
router.post('/actors/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Thiếu danh sách id diễn viên cần xóa' });
  const placeholders = ids.map(() => '?').join(',');
  const r = db.prepare(`DELETE FROM actors WHERE id IN (${placeholders})`).run(...ids);
  res.json({ deleted: r.changes });
});
router.post('/actors/delete-all', (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Cần gửi confirm: true để xóa toàn bộ diễn viên' });
  const r = db.prepare('DELETE FROM actors').run();
  res.json({ deleted: r.changes });
});

// Số ID TMDB cần đồng bộ (từ bảng actors + cast trong phim) — để biết đã lấy đủ chưa
router.get('/actors/tmdb-stats', async (req, res) => {
  try {
    const { collectTmdbPersonIds } = await import('../services/syncActorsFromTmdb.js');
    const ids = collectTmdbPersonIds();
    res.json({ total_ids: ids.length });
  } catch (e) {
    res.status(500).json({ total_ids: 0, error: e.message });
  }
});

// Đồng bộ diễn viên từ TMDB (GET /person/{id} + /person/{id}/images). Query: limit (mặc định 50)
router.post('/actors/sync-tmdb', async (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 500));
  crawlLogger.logInfo(`Crawl diễn viên TMDB bắt đầu — limit: ${limit}`, { type: 'actors_sync', limit });
  try {
    const { syncActorsFromTmdb } = await import('../services/syncActorsFromTmdb.js');
    const result = await syncActorsFromTmdb(limit);
    if (result.error) {
      crawlLogger.logWarn(`Crawl diễn viên TMDB: ${result.error}`, { type: 'actors_sync' });
    } else {
      crawlLogger.logInfo(`Crawl diễn viên TMDB xong — cập nhật: ${result.updated}, lỗi: ${result.errors}, tổng ID: ${result.total}`, { type: 'actors_sync', ...result });
    }
    res.json(result);
  } catch (e) {
    crawlLogger.logError(`Crawl diễn viên TMDB lỗi: ${e.message}`, { type: 'actors_sync' });
    res.status(500).json({ error: e.message, updated: 0, errors: 0, total: 0 });
  }
});

// Release years CRUD (năm phát hành)
router.get('/release-years', (req, res) => {
  res.json(db.prepare('SELECT id, name, slug FROM release_years ORDER BY name DESC').all());
});
router.post('/release-years', [body('name').trim().notEmpty()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const name = req.body.name.trim();
  const slug = slugify(name);
  const r = db.prepare('INSERT INTO release_years (name, slug) VALUES (?, ?)').run(name, slug);
  res.status(201).json(db.prepare('SELECT * FROM release_years WHERE id = ?').get(r.lastInsertRowid));
});
router.post('/release-years/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Thiếu danh sách id năm phát hành cần xóa' });
  const placeholders = ids.map(() => '?').join(',');
  const r = db.prepare(`DELETE FROM release_years WHERE id IN (${placeholders})`).run(...ids);
  res.json({ deleted: r.changes });
});
router.post('/release-years/delete-all', (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Cần gửi confirm: true để xóa toàn bộ năm phát hành' });
  const r = db.prepare('DELETE FROM release_years').run();
  res.json({ deleted: r.changes });
});

// ========== Quảng cáo VAST (tải lên file, lưu vào uploads/ads/vast.xml) ==========
router.post('/ads/vast', uploadVast.single('vast'), (req, res) => {
  if (req.file) {
    settingsConfig.set('vast_preroll_url', '/api/ads/vast');
  }
  if (req.body?.vast_skip_offset_seconds !== undefined) {
    const val = Math.max(0, Math.min(120, parseInt(req.body.vast_skip_offset_seconds, 10) || 0));
    settingsConfig.set('vast_skip_offset_seconds', String(val));
  }
  if (req.body?.vast_enabled !== undefined) {
    const on = req.body.vast_enabled === true || req.body.vast_enabled === '1';
    settingsConfig.set('vast_enabled', on ? '1' : '0');
  }
  res.json(settingsConfig.getForAdmin());
});

// Quảng cáo zone: popup, footer_banner, below_featured, sidebar_left, sidebar_right — bật/tắt + tải file + link (lưu uploads/ads)
router.post('/ads/zone', uploadAdZone.single('file'), (req, res) => {
  const zone = req.body?.type || req.body?.zone || '';
  if (!AD_ZONES.includes(zone)) return res.status(400).json({ error: 'Invalid zone' });
  if (req.body?.enabled !== undefined) {
    const on = req.body.enabled === true || req.body.enabled === '1';
    settingsConfig.set(`ad_${zone}_enabled`, on ? '1' : '0');
  }
  if (req.body?.link !== undefined) {
    settingsConfig.set(`ad_${zone}_link`, String(req.body.link || '').trim());
  }
  if (req.file) {
    settingsConfig.set(`ad_${zone}_file`, req.file.filename);
  } else {
    // Bật zone nhưng không gửi file: nếu đã có file mẫu trên disk thì dùng luôn
    const currentFile = (settingsConfig.get(`ad_${zone}_file`) || '').trim();
    if (!currentFile) {
      const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
      for (const ext of exts) {
        const p = path.join(adsDir, zone + ext);
        if (fs.existsSync(p)) {
          settingsConfig.set(`ad_${zone}_file`, zone + ext);
          break;
        }
      }
    }
  }
  res.json(settingsConfig.getForAdmin());
});

// ========== Settings (Cài đặt hệ thống) ==========
router.get('/settings', (req, res) => {
  res.json(settingsConfig.getForAdmin());
});

router.put('/settings', (req, res) => {
  const body = req.body || {};
  const current = settingsConfig.getAll();
  const next = {
    site_name: body.site_name !== undefined ? String(body.site_name) : current.site_name,
    site_description: body.site_description !== undefined ? String(body.site_description) : current.site_description,
    movies_per_page: body.movies_per_page !== undefined ? String(Math.min(100, Math.max(1, parseInt(body.movies_per_page, 10) || 20))) : current.movies_per_page,
    require_login: (body.require_login === true || body.require_login === '1') ? '1' : (body.require_login === false || body.require_login === '0' ? '0' : current.require_login),
    rate_limit_enabled: (body.rate_limit_enabled === true || body.rate_limit_enabled === '1') ? '1' : (body.rate_limit_enabled === false || body.rate_limit_enabled === '0' ? '0' : current.rate_limit_enabled),
    allow_register: (body.allow_register === true || body.allow_register === '1') ? '1' : (body.allow_register === false || body.allow_register === '0' ? '0' : current.allow_register),
    maintenance_mode: (body.maintenance_mode === true || body.maintenance_mode === '1') ? '1' : (body.maintenance_mode === false || body.maintenance_mode === '0' ? '0' : current.maintenance_mode),
    ga4_measurement_id: body.ga4_measurement_id !== undefined ? String(body.ga4_measurement_id).trim() : (current.ga4_measurement_id || ''),
    gtm_container_id: body.gtm_container_id !== undefined ? String(body.gtm_container_id).trim() : (current.gtm_container_id || ''),
    social_facebook: body.social_facebook !== undefined ? String(body.social_facebook).trim() : (current.social_facebook || ''),
    social_telegram: body.social_telegram !== undefined ? String(body.social_telegram).trim() : (current.social_telegram || ''),
    social_email: body.social_email !== undefined ? String(body.social_email).trim() : (current.social_email || ''),
    vast_preroll_url: body.vast_preroll_url !== undefined ? String(body.vast_preroll_url).trim() : current.vast_preroll_url,
    vast_skip_offset_seconds: body.vast_skip_offset_seconds !== undefined ? String(Math.max(0, Math.min(120, parseInt(body.vast_skip_offset_seconds, 10) || 0))) : current.vast_skip_offset_seconds,
    vast_enabled: (body.vast_enabled === true || body.vast_enabled === '1') ? '1' : (body.vast_enabled === false || body.vast_enabled === '0' ? '0' : current.vast_enabled),
    ad_popup_enabled: body.ad_popup_enabled !== undefined ? ((body.ad_popup_enabled === true || body.ad_popup_enabled === '1') ? '1' : '0') : current.ad_popup_enabled,
    ad_footer_banner_enabled: body.ad_footer_banner_enabled !== undefined ? ((body.ad_footer_banner_enabled === true || body.ad_footer_banner_enabled === '1') ? '1' : '0') : current.ad_footer_banner_enabled,
    ad_below_featured_enabled: body.ad_below_featured_enabled !== undefined ? ((body.ad_below_featured_enabled === true || body.ad_below_featured_enabled === '1') ? '1' : '0') : current.ad_below_featured_enabled,
    ad_sidebar_left_enabled: body.ad_sidebar_left_enabled !== undefined ? ((body.ad_sidebar_left_enabled === true || body.ad_sidebar_left_enabled === '1') ? '1' : '0') : current.ad_sidebar_left_enabled,
    ad_sidebar_right_enabled: body.ad_sidebar_right_enabled !== undefined ? ((body.ad_sidebar_right_enabled === true || body.ad_sidebar_right_enabled === '1') ? '1' : '0') : current.ad_sidebar_right_enabled,
    ad_popup_link: body.ad_popup_link !== undefined ? String(body.ad_popup_link || '').trim() : (current.ad_popup_link || ''),
    ad_footer_banner_link: body.ad_footer_banner_link !== undefined ? String(body.ad_footer_banner_link || '').trim() : (current.ad_footer_banner_link || ''),
    ad_below_featured_link: body.ad_below_featured_link !== undefined ? String(body.ad_below_featured_link || '').trim() : (current.ad_below_featured_link || ''),
    ad_sidebar_left_link: body.ad_sidebar_left_link !== undefined ? String(body.ad_sidebar_left_link || '').trim() : (current.ad_sidebar_left_link || ''),
    ad_sidebar_right_link: body.ad_sidebar_right_link !== undefined ? String(body.ad_sidebar_right_link || '').trim() : (current.ad_sidebar_right_link || ''),
    watch_notice: body.watch_notice !== undefined ? String(body.watch_notice).trim() : current.watch_notice,
    home_notice: body.home_notice !== undefined ? String(body.home_notice).trim() : (current.home_notice || ''),
    protection_anti_adblock_notice: body.protection_anti_adblock_notice !== undefined ? ((body.protection_anti_adblock_notice === true || body.protection_anti_adblock_notice === '1') ? '1' : '0') : (current.protection_anti_adblock_notice || '0'),
    protection_block_right_click: body.protection_block_right_click !== undefined ? ((body.protection_block_right_click === true || body.protection_block_right_click === '1') ? '1' : '0') : (current.protection_block_right_click || '0'),
    protection_block_devtools: body.protection_block_devtools !== undefined ? ((body.protection_block_devtools === true || body.protection_block_devtools === '1') ? '1' : '0') : (current.protection_block_devtools || '0'),
    protection_block_view_source: body.protection_block_view_source !== undefined ? ((body.protection_block_view_source === true || body.protection_block_view_source === '1') ? '1' : '0') : (current.protection_block_view_source || '0'),
  };
  settingsConfig.setAll(next);
  res.json(settingsConfig.getForAdmin());
});

// Server Logs (buffer in-memory)
router.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  const entries = requestLogger.getEntries(limit);
  res.json({ logs: entries });
});

// Real-time: người dùng đang xem + lượt xem trực tiếp
router.get('/realtime', (req, res) => {
  const viewers = realtimeStore.getViewers();
  const stats = realtimeStore.getStats();
  res.json({ viewers, stats });
});

export default router;
