import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'phim.db');
const db = new Database(dbPath);

db.exec(`
  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT NOT NULL,
    avatar TEXT,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    provider TEXT,
    provider_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_id)
  );

  -- Genres
  CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
  );

  -- Countries (quốc gia)
  CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
  );

  -- Directors (đạo diễn)
  CREATE TABLE IF NOT EXISTS directors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    avatar TEXT,
    biography TEXT,
    tmdb_id INTEGER
  );

  -- Actors (diễn viên)
  CREATE TABLE IF NOT EXISTS actors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    avatar TEXT,
    biography TEXT,
    tmdb_id INTEGER
  );

  -- Keywords (từ khóa)
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
  );

  -- Release years (năm phát hành)
  CREATE TABLE IF NOT EXISTS release_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
  );

  -- Movies
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    poster TEXT,
    backdrop TEXT,
    thumbnail TEXT,
    trailer_url TEXT,
    video_url TEXT,
    duration INTEGER,
    release_year INTEGER,
    rating REAL DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    type TEXT DEFAULT 'movie',
    status TEXT DEFAULT 'published',
    country TEXT,
    title_en TEXT,
    quality TEXT,
    language TEXT,
    total_episodes INTEGER DEFAULT 0,
    featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Movie-Genre many-to-many
  CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
  );

  -- User ratings
  CREATE TABLE IF NOT EXISTS user_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, movie_id)
  );

  -- Watchlist / Favorites
  CREATE TABLE IF NOT EXISTS user_favorites (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, movie_id)
  );

  -- Watch history (for AI recommendation)
  CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    watched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Comments
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'visible' CHECK(status IN ('visible', 'hidden')),
    reported_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_watch_history_movie ON watch_history(movie_id);
  CREATE INDEX IF NOT EXISTS idx_comments_movie ON comments(movie_id);
  CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
  CREATE INDEX IF NOT EXISTS idx_movies_slug ON movies(slug);
  CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating);
  CREATE INDEX IF NOT EXISTS idx_movie_genres_genre ON movie_genres(genre_id);
`);

// Migration: thêm type, status, country nếu bảng movies đã tồn tại từ trước
const cols = db.prepare("PRAGMA table_info(movies)").all();
const hasType = cols.some((c) => c.name === 'type');
const hasStatus = cols.some((c) => c.name === 'status');
const hasCountry = cols.some((c) => c.name === 'country');
const hasTitleEn = cols.some((c) => c.name === 'title_en');
const hasQuality = cols.some((c) => c.name === 'quality');
const hasLanguage = cols.some((c) => c.name === 'language');
const hasTotalEpisodes = cols.some((c) => c.name === 'total_episodes');
const hasFeatured = cols.some((c) => c.name === 'featured');
if (!hasType) db.exec("ALTER TABLE movies ADD COLUMN type TEXT DEFAULT 'movie'");
if (!hasStatus) db.exec("ALTER TABLE movies ADD COLUMN status TEXT DEFAULT 'published'");
if (!hasCountry) db.exec("ALTER TABLE movies ADD COLUMN country TEXT");
if (!hasTitleEn) db.exec("ALTER TABLE movies ADD COLUMN title_en TEXT");
if (!hasQuality) db.exec("ALTER TABLE movies ADD COLUMN quality TEXT");
if (!hasLanguage) db.exec("ALTER TABLE movies ADD COLUMN language TEXT");
if (!hasTotalEpisodes) db.exec("ALTER TABLE movies ADD COLUMN total_episodes INTEGER DEFAULT 0");
if (!hasFeatured) db.exec("ALTER TABLE movies ADD COLUMN featured INTEGER DEFAULT 0");
const hasDirector = cols.some((c) => c.name === 'director');
const hasDirectorPhoto = cols.some((c) => c.name === 'director_photo');
const hasCast = cols.some((c) => c.name === 'cast');
const hasSeriesKey = cols.some((c) => c.name === 'series_key');
const hasPartNumber = cols.some((c) => c.name === 'part_number');
if (!hasDirector) db.exec("ALTER TABLE movies ADD COLUMN director TEXT");
if (!hasDirectorPhoto) db.exec("ALTER TABLE movies ADD COLUMN director_photo TEXT");
if (!hasCast) db.exec("ALTER TABLE movies ADD COLUMN cast TEXT");
if (!hasSeriesKey) db.exec("ALTER TABLE movies ADD COLUMN series_key TEXT");
if (!hasPartNumber) db.exec("ALTER TABLE movies ADD COLUMN part_number INTEGER DEFAULT 1");
const hasSource = cols.some((c) => c.name === 'source');
if (!hasSource) db.exec("ALTER TABLE movies ADD COLUMN source TEXT");
const hasChieuRap = cols.some((c) => c.name === 'chieu_rap');
if (!hasChieuRap) db.exec('ALTER TABLE movies ADD COLUMN chieu_rap INTEGER DEFAULT 0');
const hasThuyetMinh = cols.some((c) => c.name === 'thuyet_minh');
if (!hasThuyetMinh) db.exec('ALTER TABLE movies ADD COLUMN thuyet_minh INTEGER DEFAULT 0');

// Migration: users - status, is_vip
const userCols = db.prepare("PRAGMA table_info(users)").all();
const hasUserStatus = userCols.some((c) => c.name === 'status');
const hasUserVip = userCols.some((c) => c.name === 'is_vip');
const hasEmailVerificationCode = userCols.some((c) => c.name === 'email_verification_code');
const hasEmailVerificationExpires = userCols.some((c) => c.name === 'email_verification_expires');
const hasEmailVerified = userCols.some((c) => c.name === 'email_verified');
if (!hasUserStatus) db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
if (!hasUserVip) db.exec("ALTER TABLE users ADD COLUMN is_vip INTEGER DEFAULT 0");
if (!hasEmailVerificationCode) db.exec("ALTER TABLE users ADD COLUMN email_verification_code TEXT");
if (!hasEmailVerificationExpires) db.exec("ALTER TABLE users ADD COLUMN email_verification_expires DATETIME");
if (!hasEmailVerified) db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0");

// Migration: bảng comments (nếu chưa có)
const commentTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='comments'").get();
if (!commentTable) {
  db.exec(`
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'visible' CHECK(status IN ('visible', 'hidden')),
      reported_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_comments_movie ON comments(movie_id);
    CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
  `);
}

// Migration: bảng comment_reports (user đã báo cáo comment nào)
const commentReportsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='comment_reports'").get();
if (!commentReportsTable) {
  db.exec(`
    CREATE TABLE comment_reports (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, comment_id)
    );
    CREATE INDEX IF NOT EXISTS idx_comment_reports_user ON comment_reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON comment_reports(comment_id);
  `);
}

// Migration: bảng watch_reports (báo lỗi khi xem phim)
const watchReportsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='watch_reports'").get();
if (!watchReportsTable) {
  db.exec(`
    CREATE TABLE watch_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      episode INTEGER NOT NULL DEFAULT 1,
      report_type TEXT NOT NULL DEFAULT 'other',
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'resolved')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_watch_reports_movie ON watch_reports(movie_id);
    CREATE INDEX IF NOT EXISTS idx_watch_reports_status ON watch_reports(status);
    CREATE INDEX IF NOT EXISTS idx_watch_reports_created ON watch_reports(created_at);
  `);
}

// Seed genres
const genres = [
  ['Hành động', 'hanh-dong'],
  ['Tình cảm', 'tinh-cam'],
  ['Hài hước', 'hai-huoc'],
  ['Kinh dị', 'kinh-di'],
  ['Khoa học viễn tưởng', 'khoa-hoc-vien-tuong'],
  ['Phiêu lưu', 'phieu-luu'],
  ['Hoạt hình', 'hoat-hinh'],
  ['Tài liệu', 'tai-lieu'],
];
const insertGenre = db.prepare('INSERT OR IGNORE INTO genres (name, slug) VALUES (?, ?)');
genres.forEach(([name, slug]) => insertGenre.run(name, slug));

// Seed countries
const countries = [
  ['Việt Nam', 'viet-nam'],
  ['Hàn Quốc', 'han-quoc'],
  ['Trung Quốc', 'trung-quoc'],
  ['Nhật Bản', 'nhat-ban'],
  ['Thái Lan', 'thai-lan'],
  ['Âu Mỹ', 'au-my'],
  ['Đài Loan', 'dai-loan'],
  ['Hồng Kông', 'hong-kong'],
  ['Ấn Độ', 'an-do'],
  ['Anh', 'anh'],
  ['Pháp', 'phap'],
  ['Quốc Gia Khác', 'quoc-gia-khac'],
];
const insertCountry = db.prepare('INSERT OR IGNORE INTO countries (name, slug) VALUES (?, ?)');
countries.forEach(([name, slug]) => insertCountry.run(name, slug));

// Đảm bảo tài khoản admin tồn tại và có role admin (password: admin123)
const bcrypt = await import('bcryptjs');
const hash = await bcrypt.default.hash('admin123', 10);
const adminEmail = 'admin@phim.local';
const existingAdmin = db.prepare('SELECT id, role FROM users WHERE email = ?').get(adminEmail);
if (!existingAdmin) {
  db.prepare(`
    INSERT INTO users (email, password, name, role) VALUES (?, ?, 'Admin', 'admin')
  `).run(adminEmail, hash);
} else {
  db.prepare(`
    UPDATE users SET password = ?, name = 'Admin', role = 'admin', status = 'active' WHERE email = ?
  `).run(hash, adminEmail);
}

// Seed demo movies
const movies = [
  ['Inception', 'inception', 'Giấc mơ trong giấc mơ...', 2010, 148, 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5urS.jpg', 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFcNk3orI51TX3.jpg'],
  ['The Dark Knight', 'the-dark-knight', 'Batman đối đầu Joker...', 2008, 152, 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', 'https://image.tmdb.org/t/p/original/ef4yPR8vFjvF0R7lTqF8nH8x9Y.jpg'],
  ['Interstellar', 'interstellar', 'Du hành không gian cứu nhân loại...', 2014, 169, 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', 'https://image.tmdb.org/t/p/original/xu9zaAevzQ5nnrsXN6JcahLnG4i.jpg'],
];
const insertMovie = db.prepare(`
  INSERT OR IGNORE INTO movies (title, slug, description, release_year, duration, poster, backdrop, rating) 
  VALUES (?, ?, ?, ?, ?, ?, ?, 8.5)
`);
movies.forEach(m => insertMovie.run(...m));

// Link demo movies to genres (tra cứu genre theo slug để tránh FOREIGN KEY khi id thể loại thay đổi)
const linkMovieGenre = db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)');
const getGenreId = db.prepare('SELECT id FROM genres WHERE slug = ?');
const demoLinks = [
  ['inception', 'hanh-dong', 'khoa-hoc-vien-tuong'],       // Inception: Hành động, Khoa học viễn tưởng
  ['the-dark-knight', 'hanh-dong'],                         // The Dark Knight: Hành động
  ['interstellar', 'khoa-hoc-vien-tuong', 'tai-lieu'],     // Interstellar: Khoa học viễn tưởng, Tài liệu
];
for (const [movieSlug, ...genreSlugs] of demoLinks) {
  const movieRow = db.prepare('SELECT id FROM movies WHERE slug = ?').get(movieSlug);
  if (!movieRow) continue;
  for (const gSlug of genreSlugs) {
    const genreRow = getGenreId.get(gSlug);
    if (genreRow) linkMovieGenre.run(movieRow.id, genreRow.id);
  }
}

// Bảng cài đặt hệ thống (key-value)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);
const settingCount = db.prepare('SELECT COUNT(*) as c FROM settings').get();
if (settingCount.c === 0) {
  const defaults = [
    ['site_name', 'CineViet'],
    ['site_description', 'Trang xem phim online chất lượng cao'],
    ['movies_per_page', '20'],
    ['require_login', '0'],
    ['rate_limit_enabled', '1'],
    ['allow_register', '1'],
    ['maintenance_mode', '0'],
  ];
  const ins = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  defaults.forEach(([k, v]) => ins.run(k, v));
}

// Seed vài bình luận mẫu (nếu bảng comments rỗng), dùng id thật của admin và phim theo slug
const commentCount = db.prepare('SELECT COUNT(*) as c FROM comments').get();
if (commentCount.c === 0) {
  const adminRow = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
  const commentsData = [
    ['inception', 'Phim hay tuyệt! Visuals đỉnh của chóp!', 'visible', 0],
    ['the-dark-knight', 'Batman đỉnh nhất mọi thời đại.', 'visible', 0],
    ['interstellar', 'Khá khó hiểu với người chưa đọc sách.', 'visible', 2],
  ];
  if (adminRow) {
    const ins = db.prepare('INSERT INTO comments (user_id, movie_id, content, status, reported_count) VALUES (?, ?, ?, ?, ?)');
    for (const [slug, content, status, reported] of commentsData) {
      const m = db.prepare('SELECT id FROM movies WHERE slug = ?').get(slug);
      if (m) ins.run(adminRow.id, m.id, content, status, reported);
    }
  }
}

// Migration: thêm view_count_day, view_count_month cho Sôi nổi nhất (tháng) và Top 10 (ngày)
const movieCols = db.prepare('PRAGMA table_info(movies)').all().map((c) => c.name);
if (!movieCols.includes('view_count_day')) {
  db.exec('ALTER TABLE movies ADD COLUMN view_count_day INTEGER DEFAULT 0');
}
if (!movieCols.includes('view_count_month')) {
  db.exec('ALTER TABLE movies ADD COLUMN view_count_month INTEGER DEFAULT 0');
}

console.log('Database initialized at', dbPath);
db.close();
