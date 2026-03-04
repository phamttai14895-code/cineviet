import { Router } from 'express';
import db from '../config/db.js';
import realtimeStore from '../config/realtimeStore.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { slugify, parseSeriesFromSlug } from '../utils/slugify.js';
import { ensureViewCountDayMonthReset } from '../utils/viewCountReset.js';

const router = Router();

// List movies (paginated, filter by genre, search, type, country)
router.get('/', (req, res) => {
  const { page = 1, limit = 12, genre, search, type, country, release_year, featured, chieu_rap, thuyet_minh, upcoming, sort = 'created_at', order = 'desc' } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const validSort = ['created_at', 'rating', 'release_year', 'view_count', 'view_count_day', 'title'].includes(sort) ? sort : 'created_at';
  const validOrder = order === 'asc' ? 'ASC' : 'DESC';

  const where = [];
  const params = [];
  if (upcoming === '1' || upcoming === 'true') {
    where.push("m.status = 'trailer'");
  } else {
    where.push("(m.status IS NULL OR m.status = 'published')");
  }
  if (featured === '1' || featured === 'true') {
    where.push('(m.featured = 1 OR m.featured = ?)');
    params.push(1);
  }
  if (chieu_rap === '1' || chieu_rap === 'true') {
    where.push('(m.chieu_rap = 1 OR m.chieu_rap = ?)');
    params.push(1);
  }
  // Tạm thời không lọc theo cột m.thuyet_minh vì chưa tồn tại trong schema.
  // Nếu cần filter "phim thuyết minh" sẽ xử lý ở tầng normalize dữ liệu thay vì cột riêng.
  if (genre) {
    where.push('m.id IN (SELECT movie_id FROM movie_genres WHERE genre_id = ?)');
    params.push(genre);
  }
  if (search) {
    const searchPattern = `%${search}%`;
    where.push('(m.title LIKE ? OR m.title_en LIKE ? OR m.description LIKE ? OR m.cast LIKE ?)');
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }
  if (type === 'series' || type === 'anime' || type === 'tvshows') {
    where.push('m.type = ?');
    params.push(type);
  } else if (type === 'movie') {
    where.push("(m.type IS NULL OR m.type = 'movie')");
  }
  let resolvedCountry = null;
  if (country) {
    const countryParam = (country || '').trim();
    const slugNorm = slugify(countryParam);
    // Resolve slug -> tên quốc gia thực tế trong DB (movies.country hoặc bảng countries)
    if (slugNorm) {
      const bySlug = db.prepare('SELECT name FROM countries WHERE slug = ?').get(slugNorm);
      if (bySlug) {
        resolvedCountry = bySlug.name;
      } else {
        const distinct = db.prepare('SELECT DISTINCT country FROM movies WHERE country IS NOT NULL AND country != ""').all();
        const found = distinct.find((r) => slugify(r.country) === slugNorm);
        if (found) resolvedCountry = found.country;
      }
    }
    if (!resolvedCountry) resolvedCountry = countryParam;
    where.push('m.country = ?');
    params.push(resolvedCountry);
  }
  if (release_year) {
    const year = parseInt(release_year, 10);
    if (!Number.isNaN(year) && year >= 1900 && year <= 2100) {
      where.push('m.release_year = ?');
      params.push(year);
    }
  }
  const whereClause = 'WHERE ' + where.join(' AND ');

  if (validSort === 'view_count_day') {
    ensureViewCountDayMonthReset();
  }

  const countRow = db.prepare(`
    SELECT COUNT(DISTINCT m.id) as total FROM movies m
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    ${whereClause}
  `).get(...params);
  const movies = db.prepare(`
    SELECT m.*, GROUP_CONCAT(DISTINCT g.name) as genres, GROUP_CONCAT(DISTINCT g.id) as genre_ids
    FROM movies m
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    ${whereClause}
    GROUP BY m.id
    ORDER BY m.${validSort} ${validOrder}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  const payload = {
    movies: movies.map((m) => ({
      ...m,
      genres: m.genres ? m.genres.split(',') : [],
      genre_ids: m.genre_ids ? m.genre_ids.split(',').map(Number) : [],
    })),
    total: countRow.total,
    page: parseInt(page) || 1,
    limit: limitNum,
  };
  if (country && resolvedCountry) payload.resolved_country = resolvedCountry;
  res.json(payload);
});

// Random 1 phim (query: genre, country, release_year — tùy chọn)
router.get('/random', (req, res) => {
  const { genre, country, release_year } = req.query;
  const where = ["(m.status IS NULL OR m.status = 'published')"];
  const params = [];
  if (genre) {
    where.push('m.id IN (SELECT movie_id FROM movie_genres WHERE genre_id = ?)');
    params.push(genre);
  }
  let resolvedCountry = null;
  if (country && String(country).trim()) {
    const countryParam = String(country).trim();
    const slugNorm = slugify(countryParam);
    if (slugNorm) {
      const bySlug = db.prepare('SELECT name FROM countries WHERE slug = ?').get(slugNorm);
      if (bySlug) resolvedCountry = bySlug.name;
      else {
        const distinct = db.prepare('SELECT DISTINCT country FROM movies WHERE country IS NOT NULL AND country != ""').all();
        const found = distinct.find((r) => slugify(r.country) === slugNorm);
        if (found) resolvedCountry = found.country;
      }
    }
    if (!resolvedCountry) resolvedCountry = countryParam;
    where.push('m.country = ?');
    params.push(resolvedCountry);
  }
  if (release_year) {
    const year = parseInt(release_year, 10);
    if (!Number.isNaN(year) && year >= 1900 && year <= 2100) {
      where.push('m.release_year = ?');
      params.push(year);
    }
  }
  const whereClause = 'WHERE ' + where.join(' AND ');
  const row = db.prepare(`
    SELECT m.*, GROUP_CONCAT(DISTINCT g.name) as genres, GROUP_CONCAT(DISTINCT g.id) as genre_ids
    FROM movies m
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    ${whereClause}
    GROUP BY m.id
    ORDER BY RANDOM()
    LIMIT 1
  `).get(...params);
  if (!row) return res.json({ movie: null });
  const movie = {
    ...row,
    genres: row.genres ? row.genres.split(',') : [],
    genre_ids: row.genre_ids ? row.genre_ids.split(',').map(Number) : [],
  };
  res.json({ movie });
});

// Gợi ý tìm kiếm (dropdown): tìm theo tên VN, tên EN, diễn viên (cast)
router.get('/suggest', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
  if (!q) return res.json({ movies: [] });
  const pattern = `%${q}%`;
  const where = "(m.status IS NULL OR m.status = 'published') AND (m.title LIKE ? OR m.title_en LIKE ? OR m.description LIKE ? OR m.cast LIKE ?)";
  const movies = db.prepare(`
    SELECT m.id, m.title, m.title_en, m.slug, m.poster, m.thumbnail
    FROM movies m
    WHERE ${where}
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(pattern, pattern, pattern, pattern, limit);
  res.json({ movies });
});

// List comments for a movie (chỉ hiển thị visible; có like_count, user_liked khi đăng nhập)
router.get('/:id/comments', optionalAuth, (req, res) => {
  const movieId = parseInt(req.params.id);
  const movie = db.prepare('SELECT id FROM movies WHERE id = ?').get(movieId);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  const userId = req.user ? req.user.id : 0;
  const list = db.prepare(`
    SELECT c.id, c.user_id, c.content, c.status, c.created_at, c.is_spoiler, c.rating, c.parent_id,
           u.name as user_name, u.avatar as user_avatar,
           (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as like_count,
           (SELECT 1 FROM comment_likes cl2 WHERE cl2.comment_id = c.id AND cl2.user_id = ? LIMIT 1) as user_liked
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.movie_id = ? AND c.status = 'visible'
    ORDER BY COALESCE(c.parent_id, c.id) DESC, c.created_at ASC
  `).all(userId, movieId);
  const out = list.map((row) => ({
    ...row,
    like_count: row.like_count ?? 0,
    user_liked: !!row.user_liked,
  }));
  res.json(out);
});

// Create comment (auth) — hỗ trợ is_spoiler, rating, parent_id (trả lời)
router.post('/:id/comments', requireAuth, (req, res) => {
  const movieId = parseInt(req.params.id);
  const content = (req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Nội dung không được để trống' });
  const movie = db.prepare('SELECT id FROM movies WHERE id = ?').get(movieId);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  const isSpoiler = !!req.body?.is_spoiler;
  let rating = req.body?.rating != null ? parseInt(req.body.rating, 10) : null;
  if (rating != null && (rating < 1 || rating > 5)) rating = null;
  let parentId = req.body?.parent_id != null ? parseInt(req.body.parent_id, 10) : null;
  if (parentId) {
    const parent = db.prepare('SELECT id, movie_id FROM comments WHERE id = ?').get(parentId);
    if (!parent || parent.movie_id !== movieId) parentId = null;
  }
  const r = db.prepare(
    "INSERT INTO comments (user_id, movie_id, content, is_spoiler, rating, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now','+7 hours'))"
  ).run(req.user.id, movieId, content, isSpoiler ? 1 : 0, rating, parentId);
  const comment = db.prepare(`
    SELECT c.id, c.user_id, c.movie_id, c.content, c.status, c.created_at, c.is_spoiler, c.rating, c.parent_id,
           u.name as user_name, u.avatar as user_avatar
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(r.lastInsertRowid);
  const likeCount = db.prepare('SELECT COUNT(*) as c FROM comment_likes WHERE comment_id = ?').get(comment.id);
  res.status(201).json({ ...comment, like_count: likeCount?.c ?? 0, user_liked: false });
});

// Like / unlike comment (auth)
router.post('/:id/comments/:commentId/like', requireAuth, (req, res) => {
  const movieId = parseInt(req.params.id);
  const commentId = parseInt(req.params.commentId);
  const comment = db.prepare('SELECT id, movie_id FROM comments WHERE id = ?').get(commentId);
  if (!comment || comment.movie_id !== movieId) return res.status(404).json({ error: 'Không tìm thấy bình luận' });
  const existing = db.prepare('SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = ?').get(req.user.id, commentId);
  if (existing) {
    db.prepare('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?').run(req.user.id, commentId);
    const c = db.prepare('SELECT COUNT(*) as c FROM comment_likes WHERE comment_id = ?').get(commentId);
    return res.json({ liked: false, like_count: c?.c ?? 0 });
  }
  db.prepare('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)').run(req.user.id, commentId);
  const c = db.prepare('SELECT COUNT(*) as c FROM comment_likes WHERE comment_id = ?').get(commentId);
  res.json({ liked: true, like_count: c?.c ?? 0 });
});

// Update own comment (auth, chỉ chủ bình luận)
router.patch('/:id/comments/:commentId', requireAuth, (req, res) => {
  const movieId = parseInt(req.params.id);
  const commentId = parseInt(req.params.commentId);
  const content = (req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Nội dung không được để trống' });
  const comment = db.prepare('SELECT id, user_id, movie_id FROM comments WHERE id = ? AND movie_id = ?').get(commentId, movieId);
  if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận' });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'Chỉ được sửa bình luận của mình' });
  db.prepare('UPDATE comments SET content = ? WHERE id = ?').run(content, commentId);
  const updated = db.prepare('SELECT c.*, u.name as user_name, u.avatar as user_avatar FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(commentId);
  const likeCount = db.prepare('SELECT COUNT(*) as c FROM comment_likes WHERE comment_id = ?').get(commentId);
  const userLiked = req.user ? db.prepare('SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?').get(commentId, req.user.id) : null;
  res.json({ ...updated, like_count: likeCount?.c ?? 0, user_liked: !!userLiked });
});

// Delete own comment (auth, chỉ chủ bình luận)
router.delete('/:id/comments/:commentId', requireAuth, (req, res) => {
  const movieId = parseInt(req.params.id);
  const commentId = parseInt(req.params.commentId);
  const comment = db.prepare('SELECT id, user_id, movie_id FROM comments WHERE id = ? AND movie_id = ?').get(commentId, movieId);
  if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận' });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'Chỉ được xóa bình luận của mình' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  res.json({ ok: true });
});

// Get single movie by id or slug
router.get('/:idOrSlug', (req, res) => {
  const idOrSlug = req.params.idOrSlug;
  const isNum = /^\d+$/.test(idOrSlug);
  const movie = db.prepare(`
    SELECT m.*, GROUP_CONCAT(g.name) as genres, GROUP_CONCAT(g.id) as genre_ids
    FROM movies m
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    WHERE m.${isNum ? 'id' : 'slug'} = ?
    GROUP BY m.id
  `).get(idOrSlug);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  movie.genres = movie.genres ? movie.genres.split(',') : [];
  movie.genre_ids = movie.genre_ids ? movie.genre_ids.split(',').map(Number) : [];
  if (typeof movie.cast === 'string') {
    try {
      movie.cast = movie.cast ? JSON.parse(movie.cast) : [];
    } catch {
      movie.cast = [];
    }
  }
  if (!Array.isArray(movie.cast)) movie.cast = [];
  // Gắn avatar diễn viên từ bảng actors (để trang xem phim / chi tiết hiện ảnh)
  const castNames = [...new Set(movie.cast.map((c) => (c.name || '').trim()).filter(Boolean))];
  if (castNames.length > 0) {
    const actorsByName = new Map();
    const placeholders = castNames.map(() => '?').join(',');
    const actors = db.prepare(
      `SELECT name, avatar FROM actors WHERE TRIM(name) IN (${placeholders}) AND avatar IS NOT NULL AND avatar != ''`
    ).all(...castNames.map((n) => n.trim()));
    actors.forEach((a) => {
      const key = (a.name || '').trim().toLowerCase();
      if (!actorsByName.has(key)) actorsByName.set(key, a.avatar);
    });
    movie.cast.forEach((person) => {
      const name = (person.name || '').trim();
      const avatar = name ? actorsByName.get(name.toLowerCase()) : null;
      if (avatar) person.avatar = avatar;
      if (avatar && !person.photo) person.photo = avatar;
    });
  }
  if (typeof movie.episodes === 'string') {
    try {
      movie.episodes = movie.episodes ? JSON.parse(movie.episodes) : [];
    } catch {
      movie.episodes = [];
    }
  }
  if (!Array.isArray(movie.episodes)) movie.episodes = [];
  // Phim nhiều phần (phần 1, 2, 3, 4...): gộp theo series_key hoặc slug dạng xxx-phan-N/xxx-part-N → trả về movie.parts để trang xem hiện dropdown "Chọn phần"
  let seriesKey = movie.series_key && String(movie.series_key).trim();
  if (seriesKey) {
    try {
      const parts = db.prepare(`
        SELECT id, title, part_number FROM movies
        WHERE series_key = ? AND (status IS NULL OR status = 'published')
        ORDER BY COALESCE(part_number, 1) ASC
      `).all(seriesKey);
      movie.parts = parts.map((p) => ({ id: p.id, title: p.title, part_number: p.part_number != null ? p.part_number : 1 }));
    } catch (_) {
      movie.parts = [{ id: movie.id, title: movie.title, part_number: movie.part_number != null ? movie.part_number : 1 }];
    }
  } else {
    const fromSlug = parseSeriesFromSlug(movie.slug || '');
    if (fromSlug) {
      const base = fromSlug.series_key;
      const all = db.prepare(`
        SELECT id, title, slug, part_number FROM movies
        WHERE (status IS NULL OR status = 'published')
          AND (slug = ? OR slug LIKE ? OR slug LIKE ?)
      `).all(base, base + '-phan-%', base + '-part-%');
      const withNum = all.map((m) => {
        const parsed = parseSeriesFromSlug(m.slug) || { part_number: m.part_number != null ? m.part_number : 1 };
        return { id: m.id, title: m.title, part_number: parsed.part_number };
      });
      withNum.sort((a, b) => a.part_number - b.part_number);
      movie.parts = withNum.length >= 1 ? withNum : [{ id: movie.id, title: movie.title, part_number: fromSlug.part_number }];
    } else {
      movie.parts = [{ id: movie.id, title: movie.title, part_number: movie.part_number != null ? movie.part_number : 1 }];
    }
  }
  // Đề xuất cho bạn: cùng thể loại (hoặc mới nhất), tránh request riêng fail trên tablet
  const genreId = movie.genre_ids && movie.genre_ids[0];
  const relatedLimit = 15;
  let related = [];
  if (genreId) {
    related = db.prepare(`
      SELECT m.*, GROUP_CONCAT(DISTINCT g.name) as genres, GROUP_CONCAT(DISTINCT g.id) as genre_ids
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.id IN (SELECT movie_id FROM movie_genres WHERE genre_id = ?) AND m.id != ?
        AND (m.status IS NULL OR m.status = 'published')
      GROUP BY m.id
      ORDER BY m.rating DESC, m.view_count DESC
      LIMIT ?
    `).all(genreId, movie.id, relatedLimit);
  }
  if (related.length < relatedLimit) {
    const excludeIds = [movie.id, ...related.map((r) => r.id)];
    const placeholders = excludeIds.map(() => '?').join(',');
    const more = db.prepare(`
      SELECT m.*, GROUP_CONCAT(DISTINCT g.name) as genres, GROUP_CONCAT(DISTINCT g.id) as genre_ids
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.id NOT IN (${placeholders}) AND (m.status IS NULL OR m.status = 'published')
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(...excludeIds, relatedLimit - related.length);
    related = [...related, ...more];
  }
  movie.related = related.map((m) => ({
    ...m,
    genres: m.genres ? m.genres.split(',') : [],
    genre_ids: m.genre_ids ? m.genre_ids.split(',').map(Number) : [],
  }));
  res.json(movie);
});

// Increment view & record watch history (auth). episode: tập đang xem (đồng bộ đa thiết bị).
router.post('/:id/watch', requireAuth, (req, res) => {
  const movieId = parseInt(req.params.id);
  const { progress = 0, completed = 0, episode = 1, position_seconds } = req.body || {};
  const ep = Math.max(1, parseInt(episode, 10) || 1);
  const posSec = position_seconds != null && Number.isFinite(Number(position_seconds)) ? Math.max(0, Number(position_seconds)) : null;
  const movie = db.prepare('SELECT id, title FROM movies WHERE id = ?').get(movieId);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  db.prepare('UPDATE movies SET view_count = view_count + 1, view_count_day = COALESCE(view_count_day, 0) + 1, view_count_month = COALESCE(view_count_month, 0) + 1 WHERE id = ?').run(movieId);
  const existing = db.prepare('SELECT id FROM watch_history WHERE user_id = ? AND movie_id = ?').get(req.user.id, movieId);
  if (existing) {
    if (posSec !== null) {
      db.prepare("UPDATE watch_history SET progress = ?, completed = ?, episode = ?, position_seconds = ?, watched_at = datetime('now','+7 hours') WHERE user_id = ? AND movie_id = ?").run(progress, completed ? 1 : 0, ep, posSec, req.user.id, movieId);
    } else {
      db.prepare("UPDATE watch_history SET progress = ?, completed = ?, episode = ?, watched_at = datetime('now','+7 hours') WHERE user_id = ? AND movie_id = ?").run(progress, completed ? 1 : 0, ep, req.user.id, movieId);
    }
  } else {
    db.prepare('INSERT INTO watch_history (user_id, movie_id, progress, completed, episode, position_seconds) VALUES (?, ?, ?, ?, ?, ?)').run(req.user.id, movieId, progress, completed ? 1 : 0, ep, posSec ?? 0);
  }
  realtimeStore.heartbeat(req.user.id, req.user.name, movieId, movie.title);
  res.json({ ok: true });
});

// Toggle favorite
router.post('/:id/favorite', requireAuth, (req, res) => {
  const movieId = parseInt(req.params.id);
  const exists = db.prepare('SELECT 1 FROM user_favorites WHERE user_id = ? AND movie_id = ?').get(req.user.id, movieId);
  if (exists) {
    db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND movie_id = ?').run(req.user.id, movieId);
    return res.json({ favorited: false });
  }
  db.prepare('INSERT INTO user_favorites (user_id, movie_id) VALUES (?, ?)').run(req.user.id, movieId);
  res.json({ favorited: true });
});

// Rate movie
router.post('/:id/rate', requireAuth, (req, res) => {
  const movieId = parseInt(req.params.id);
  const rating = Math.min(5, Math.max(1, parseInt(req.body?.rating) || 0));
  if (!rating) return res.status(400).json({ error: 'Rating 1-5' });
  db.prepare('INSERT OR REPLACE INTO user_ratings (user_id, movie_id, rating) VALUES (?, ?, ?)').run(req.user.id, movieId, rating);
  const avg = db.prepare('SELECT AVG(rating) as avg FROM user_ratings WHERE movie_id = ?').get(movieId);
  db.prepare('UPDATE movies SET rating = ROUND(?, 1) WHERE id = ?').run(avg.avg || 0, movieId);
  res.json({ rating: avg.avg, userRating: rating });
});

// Rating stats (distribution 1-5, total, userRating when auth)
router.get('/:id/rating-stats', optionalAuth, (req, res) => {
  const movieId = parseInt(req.params.id);
  const movie = db.prepare('SELECT id, rating, view_count FROM movies WHERE id = ?').get(movieId);
  if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
  const rows = db.prepare('SELECT rating, COUNT(*) as count FROM user_ratings WHERE movie_id = ? GROUP BY rating').all(movieId);
  const distribution = [0, 0, 0, 0, 0];
  let total = 0;
  rows.forEach((r) => {
    const i = Math.max(0, Math.min(4, parseInt(r.rating, 10) - 1));
    distribution[i] = r.count;
    total += r.count;
  });
  let userRating = null;
  if (req.user) {
    const u = db.prepare('SELECT rating FROM user_ratings WHERE user_id = ? AND movie_id = ?').get(req.user.id, movieId);
    if (u) userRating = u.rating;
  }
  res.json({
    distribution,
    total,
    average: movie.rating != null ? Number(movie.rating) : 0,
    view_count: movie.view_count != null ? movie.view_count : 0,
    userRating,
  });
});

// Genres list
router.get('/meta/genres', (req, res) => {
  const genres = db.prepare('SELECT id, name, slug FROM genres ORDER BY name').all();
  res.json(genres);
});

// Countries list — cùng nguồn với admin (bảng countries)
router.get('/meta/countries', (req, res) => {
  const countries = db.prepare('SELECT id, name, slug FROM countries ORDER BY name').all();
  res.json(countries);
});

export default router;
