import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { slugify, parseSeriesFromSlug } from '../utils/slugify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/phim.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migration: thêm cột source vào movies nếu chưa có (tránh lỗi crawl)
try {
  const cols = db.prepare("PRAGMA table_info(movies)").all();
  const hasSource = cols.some((c) => c.name === 'source');
  if (!hasSource) {
    db.exec('ALTER TABLE movies ADD COLUMN source TEXT');
  }
} catch (_) { /* bảng movies chưa tồn tại, bỏ qua */ }

// Migration: thêm cột avatar (ảnh từ TMDB) cho directors và actors
try {
  const dirCols = db.prepare("PRAGMA table_info(directors)").all();
  if (dirCols.length && !dirCols.some((c) => c.name === 'avatar')) {
    db.exec('ALTER TABLE directors ADD COLUMN avatar TEXT');
  }
} catch (_) {}
try {
  const actCols = db.prepare("PRAGMA table_info(actors)").all();
  if (actCols.length && !actCols.some((c) => c.name === 'avatar')) {
    db.exec('ALTER TABLE actors ADD COLUMN avatar TEXT');
  }
} catch (_) {}

// Migration: thêm cột biography, tmdb_id cho directors và actors (TMDB /person/{id}, /person/{id}/images)
try {
  const dirCols = db.prepare("PRAGMA table_info(directors)").all();
  if (dirCols.length && !dirCols.some((c) => c.name === 'biography')) {
    db.exec('ALTER TABLE directors ADD COLUMN biography TEXT');
  }
  if (dirCols.length && !dirCols.some((c) => c.name === 'tmdb_id')) {
    db.exec('ALTER TABLE directors ADD COLUMN tmdb_id INTEGER');
  }
} catch (_) {}
try {
  const actCols = db.prepare("PRAGMA table_info(actors)").all();
  if (actCols.length && !actCols.some((c) => c.name === 'biography')) {
    db.exec('ALTER TABLE actors ADD COLUMN biography TEXT');
  }
  if (actCols.length && !actCols.some((c) => c.name === 'tmdb_id')) {
    db.exec('ALTER TABLE actors ADD COLUMN tmdb_id INTEGER');
  }
} catch (_) {}

// Migration: actors — other_names, gender, birthday, place_of_birth (TMDB person)
try {
  const actCols = db.prepare("PRAGMA table_info(actors)").all();
  if (actCols.length) {
    if (!actCols.some((c) => c.name === 'other_names')) db.exec('ALTER TABLE actors ADD COLUMN other_names TEXT');
    if (!actCols.some((c) => c.name === 'gender')) db.exec('ALTER TABLE actors ADD COLUMN gender INTEGER');
    if (!actCols.some((c) => c.name === 'birthday')) db.exec('ALTER TABLE actors ADD COLUMN birthday TEXT');
    if (!actCols.some((c) => c.name === 'place_of_birth')) db.exec('ALTER TABLE actors ADD COLUMN place_of_birth TEXT');
  }
} catch (_) {}

// Migration: chuẩn hóa slug actors/directors (NFD) để khớp link frontend (Hồng → hong-cnh-du)
try {
  const actors = db.prepare('SELECT id, name, slug FROM actors').all();
  const updateActor = db.prepare('UPDATE actors SET slug = ? WHERE id = ?');
  for (const a of actors) {
    const newSlug = slugify(a.name);
    if (newSlug && newSlug !== a.slug) updateActor.run(newSlug, a.id);
  }
  const directors = db.prepare('SELECT id, name, slug FROM directors').all();
  const updateDirector = db.prepare('UPDATE directors SET slug = ? WHERE id = ?');
  for (const d of directors) {
    const newSlug = slugify(d.name);
    if (newSlug && newSlug !== d.slug) updateDirector.run(newSlug, d.id);
  }
} catch (_) { /* bảng chưa có hoặc lỗi, bỏ qua */ }

// Migration: thêm mọi tên trong movies.cast vào bảng actors (nếu chưa có)
try {
  const existingNames = new Set(db.prepare('SELECT name FROM actors').all().map((r) => r.name));
  const insertActor = db.prepare('INSERT OR IGNORE INTO actors (name, slug) VALUES (?, ?)');
  const rows = db.prepare('SELECT id, "cast" FROM movies').all();
  for (const m of rows) {
    let cast = [];
    try { cast = JSON.parse(m.cast || '[]'); } catch (_) {}
    if (!Array.isArray(cast)) continue;
    for (const entry of cast) {
      const name = typeof entry === 'object' && entry && entry.name != null ? String(entry.name).trim() : (typeof entry === 'string' ? entry.trim() : '');
      if (!name || existingNames.has(name)) continue;
      const slug = slugify(name);
      if (!slug) continue;
      try {
        insertActor.run(name, slug);
        existingNames.add(name);
      } catch (_) {}
    }
  }
} catch (_) {}

// Migration: phim nhiều phần — gộp bằng series_key, part_number (chọn phần trên trang xem)
try {
  const movieCols = db.prepare('PRAGMA table_info(movies)').all();
  const hasSeriesKey = movieCols.some((c) => c.name === 'series_key');
  const hasPartNumber = movieCols.some((c) => c.name === 'part_number');
  if (!hasSeriesKey) db.exec('ALTER TABLE movies ADD COLUMN series_key TEXT');
  if (!hasPartNumber) db.exec('ALTER TABLE movies ADD COLUMN part_number INTEGER DEFAULT 1');
} catch (_) {}

// Migration: điền series_key, part_number cho phim có slug dạng -phan-N / -part-N (chưa có)
try {
  const rows = db.prepare('SELECT id, slug, series_key FROM movies').all();
  const update = db.prepare('UPDATE movies SET series_key = ?, part_number = ? WHERE id = ?');
  for (const m of rows) {
    if (m.series_key != null && m.series_key !== '') continue;
    const parsed = parseSeriesFromSlug(m.slug || '');
    if (parsed) update.run(parsed.series_key, parsed.part_number, m.id);
  }
} catch (_) {}

// Migration: cột episodes (JSON) — danh sách server + link từng tập khi crawl
try {
  const movieCols = db.prepare('PRAGMA table_info(movies)').all();
  if (movieCols.length && !movieCols.some((c) => c.name === 'episodes')) {
    db.exec('ALTER TABLE movies ADD COLUMN episodes TEXT');
  }
} catch (_) {}

// Migration: episode_current — tập mới nhất đã ra (để hiển thị "Hoàn Tất" / "Tập X" trên card)
try {
  const movieColsEc = db.prepare('PRAGMA table_info(movies)').all();
  if (movieColsEc.length && !movieColsEc.some((c) => c.name === 'episode_current')) {
    db.exec('ALTER TABLE movies ADD COLUMN episode_current INTEGER DEFAULT NULL');
  }
} catch (_) {}

// Migration: cột chieu_rap, thuyet_minh (crawl dùng — tránh lỗi "no such column")
try {
  const movieCols = db.prepare('PRAGMA table_info(movies)').all();
  if (movieCols.length) {
    if (!movieCols.some((c) => c.name === 'chieu_rap')) {
      db.exec('ALTER TABLE movies ADD COLUMN chieu_rap INTEGER DEFAULT 0');
    }
    if (!movieCols.some((c) => c.name === 'thuyet_minh')) {
      db.exec('ALTER TABLE movies ADD COLUMN thuyet_minh INTEGER DEFAULT 0');
    }
    if (!movieCols.some((c) => c.name === 'thumbnail')) {
      db.exec('ALTER TABLE movies ADD COLUMN thumbnail TEXT');
    }
    if (!movieCols.some((c) => c.name === 'view_count_day')) {
      db.exec('ALTER TABLE movies ADD COLUMN view_count_day INTEGER DEFAULT 0');
    }
    if (!movieCols.some((c) => c.name === 'view_count_month')) {
      db.exec('ALTER TABLE movies ADD COLUMN view_count_month INTEGER DEFAULT 0');
    }
    if (!movieCols.some((c) => c.name === 'subtitle_url')) {
      db.exec('ALTER TABLE movies ADD COLUMN subtitle_url TEXT');
    }
  }
} catch (_) {}

// Migration: watch_history.episode — đồng bộ đa thiết bị (tiếp tục xem đúng tập)
try {
  const whCols = db.prepare('PRAGMA table_info(watch_history)').all();
  if (whCols.length && !whCols.some((c) => c.name === 'episode')) {
    db.exec('ALTER TABLE watch_history ADD COLUMN episode INTEGER DEFAULT 1');
  }
} catch (_) {}

// Migration: watch_history.position_seconds — thời gian (giây) đã xem để hiển thị và seek
try {
  const whCols2 = db.prepare('PRAGMA table_info(watch_history)').all();
  if (whCols2.length && !whCols2.some((c) => c.name === 'position_seconds')) {
    db.exec('ALTER TABLE watch_history ADD COLUMN position_seconds REAL DEFAULT 0');
  }
} catch (_) {}

// Migration: login_log — ghi lại mỗi lần đăng nhập cho dashboard "Hoạt động gần đây"
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      logged_at TEXT NOT NULL DEFAULT (datetime('now','+7 hours')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
} catch (_) {}

// Migration: cài đặt thông báo user (tab Thông báo trong modal cá nhân)
try {
  const userCols = db.prepare('PRAGMA table_info(users)').all();
  if (userCols.length) {
    if (!userCols.some((c) => c.name === 'notify_phim_moi')) {
      db.exec('ALTER TABLE users ADD COLUMN notify_phim_moi INTEGER DEFAULT 1');
    }
    if (!userCols.some((c) => c.name === 'notify_tap_moi')) {
      db.exec('ALTER TABLE users ADD COLUMN notify_tap_moi INTEGER DEFAULT 1');
    }
    if (!userCols.some((c) => c.name === 'notify_watch_party')) {
      db.exec('ALTER TABLE users ADD COLUMN notify_watch_party INTEGER DEFAULT 0');
    }
    if (!userCols.some((c) => c.name === 'notify_uu_dai')) {
      db.exec('ALTER TABLE users ADD COLUMN notify_uu_dai INTEGER DEFAULT 0');
    }
    if (!userCols.some((c) => c.name === 'notification_read_at')) {
      db.exec('ALTER TABLE users ADD COLUMN notification_read_at TEXT');
    }
  }
} catch (_) {}

// Migration: comments — is_spoiler, rating, parent_id (trả lời); comment_likes
try {
  const commentCols = db.prepare('PRAGMA table_info(comments)').all();
  if (commentCols.length) {
    if (!commentCols.some((c) => c.name === 'is_spoiler')) {
      db.exec('ALTER TABLE comments ADD COLUMN is_spoiler INTEGER DEFAULT 0');
    }
    if (!commentCols.some((c) => c.name === 'rating')) {
      db.exec('ALTER TABLE comments ADD COLUMN rating INTEGER');
    }
    if (!commentCols.some((c) => c.name === 'parent_id')) {
      db.exec('ALTER TABLE comments ADD COLUMN parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE');
    }
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, comment_id)
    )
  `);
} catch (_) {}

export default db;
