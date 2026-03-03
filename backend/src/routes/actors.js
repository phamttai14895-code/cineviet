import { Router } from 'express';
import db from '../config/db.js';
import { slugify } from '../utils/slugify.js';

const router = Router();

// Danh sách diễn viên (public; 30/trang). Query: search = tìm theo tên tiếng Việt + tên khác (tiếng Anh, v.v.)
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const offset = (page - 1) * limit;
  const searchRaw = (req.query.search || req.query.q || '').trim();
  const searchTerm = searchRaw.replace(/%/g, '\\%').replace(/_/g, '\\_');
  const pattern = searchTerm ? `%${searchTerm}%` : null;

  let total;
  let list;
  if (pattern) {
    total = db.prepare(`
      SELECT COUNT(*) as n FROM actors
      WHERE name LIKE ? ESCAPE '\\' OR (other_names IS NOT NULL AND other_names != '' AND other_names LIKE ? ESCAPE '\\')
    `).get(pattern, pattern).n;
    list = db.prepare(`
      SELECT id, name, slug, avatar, biography, tmdb_id, other_names, gender, birthday, place_of_birth
      FROM actors
      WHERE name LIKE ? ESCAPE '\\' OR (other_names IS NOT NULL AND other_names != '' AND other_names LIKE ? ESCAPE '\\')
      ORDER BY (avatar IS NOT NULL AND avatar != '') DESC, name
      LIMIT ? OFFSET ?
    `).all(pattern, pattern, limit, offset);
  } else {
    total = db.prepare('SELECT COUNT(*) as n FROM actors').get().n;
    list = db.prepare(`
      SELECT id, name, slug, avatar, biography, tmdb_id, other_names, gender, birthday, place_of_birth
      FROM actors
      ORDER BY (avatar IS NOT NULL AND avatar != '') DESC, name
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  }
  res.json({ actors: list, total, page, limit });
});

// Chi tiết diễn viên + filmography (public). Slug chuẩn: không dấu, lowercase, nối bằng -.
router.get('/:slug', (req, res) => {
  let slugParam = (req.params.slug || '').trim();
  if (!slugParam) return res.status(404).json({ error: 'Không tìm thấy diễn viên' });
  const canonicalSlug = slugify(slugParam);
  if (canonicalSlug) slugParam = canonicalSlug;

  let actor = db.prepare('SELECT id, name, slug, avatar, biography, tmdb_id, other_names, gender, birthday, place_of_birth FROM actors WHERE slug = ?').get(slugParam);
  if (!actor) {
    const all = db.prepare('SELECT id, name, slug, avatar, biography, tmdb_id, other_names, gender, birthday, place_of_birth FROM actors').all();
    actor = all.find((a) => slugify(a.name) === slugParam);
  }

  // Nếu vẫn không có trong bảng actors: tìm trong cast của từng phim (tên slugify trùng slug)
  if (!actor) {
    const moviesRows = db.prepare(`
      SELECT id, title, title_en, slug, poster, backdrop, release_year, type, total_episodes, rating, view_count, description, "cast"
      FROM movies
      WHERE (status IS NULL OR status = 'published')
    `).all();
    let canonicalName = null;
    const filmIds = [];
    for (const m of moviesRows) {
      let cast = [];
      try { cast = JSON.parse(m.cast || '[]'); } catch (_) {}
      if (!Array.isArray(cast)) continue;
      for (const entry of cast) {
        const name = typeof entry === 'object' && entry && entry.name != null ? String(entry.name).trim() : (typeof entry === 'string' ? entry.trim() : '');
        if (!name || slugify(name) !== slugParam) continue;
        if (!canonicalName) canonicalName = name;
        filmIds.push(m.id);
        break;
      }
    }
    if (canonicalName && filmIds.length > 0) {
      const insertActor = db.prepare('INSERT OR IGNORE INTO actors (name, slug) VALUES (?, ?)');
      try { insertActor.run(canonicalName, slugParam); } catch (_) {}
      const fromDb = db.prepare('SELECT id, name, slug, avatar, biography, tmdb_id, other_names, gender, birthday, place_of_birth FROM actors WHERE slug = ? OR name = ?').get(slugParam, canonicalName);
      actor = fromDb || { id: null, name: canonicalName, slug: slugParam, avatar: null, biography: null, tmdb_id: null, other_names: null, gender: null, birthday: null, place_of_birth: null };
      const idList = filmIds.join(',');
      const movies = db.prepare(`
        SELECT id, title, title_en, slug, poster, backdrop, release_year, type, total_episodes, rating, view_count, description
        FROM movies WHERE id IN (${idList})
        ORDER BY release_year DESC, rating DESC
      `).all();
      const filmography = movies.map((m) => ({
        id: m.id,
        title: m.title,
        title_en: m.title_en || null,
        slug: m.slug,
        poster: m.poster,
        backdrop: m.backdrop,
        release_year: m.release_year,
        type: m.type || 'movie',
        total_episodes: m.total_episodes || 0,
        rating: m.rating,
        view_count: m.view_count,
        description: m.description,
      }));
      return res.json({ ...actor, filmography });
    }
    return res.status(404).json({ error: 'Không tìm thấy diễn viên' });
  }

  // Phim có diễn viên này trong cast (khớp theo tên hoặc slug của tên)
  const nameEsc = actor.name.replace(/"/g, '""');
  const pattern1 = `%"name":"${nameEsc}"%`;
  const pattern2 = `%"${nameEsc}"%`;
  let movies = db.prepare(`
    SELECT id, title, title_en, slug, poster, backdrop, release_year, type, total_episodes, rating, view_count, description
    FROM movies
    WHERE (status IS NULL OR status = 'published')
      AND ("cast" LIKE ? OR "cast" LIKE ?)
    ORDER BY release_year DESC, rating DESC
  `).all(pattern1, pattern2);

  // Bổ sung phim có cast trùng slug (tên viết khác nhưng slug giống)
  if (movies.length === 0) {
    const allMovies = db.prepare(`
      SELECT id, title, title_en, slug, poster, backdrop, release_year, type, total_episodes, rating, view_count, description, "cast"
      FROM movies WHERE (status IS NULL OR status = 'published')
    `).all();
    const ids = new Set();
    for (const m of allMovies) {
      let cast = [];
      try { cast = JSON.parse(m.cast || '[]'); } catch (_) {}
      if (!Array.isArray(cast)) continue;
      for (const entry of cast) {
        const name = typeof entry === 'object' && entry && entry.name != null ? String(entry.name).trim() : (typeof entry === 'string' ? entry.trim() : '');
        if (name && slugify(name) === actor.slug) { ids.add(m.id); break; }
      }
    }
    if (ids.size > 0) {
      movies = db.prepare(`
        SELECT id, title, title_en, slug, poster, backdrop, release_year, type, total_episodes, rating, view_count, description
        FROM movies WHERE id IN (${[...ids].join(',')})
        ORDER BY release_year DESC, rating DESC
      `).all();
    }
  }

  const filmography = movies.map((m) => ({
    id: m.id,
    title: m.title,
    title_en: m.title_en || null,
    slug: m.slug,
    poster: m.poster,
    backdrop: m.backdrop,
    release_year: m.release_year,
    type: m.type || 'movie',
    total_episodes: m.total_episodes || 0,
    rating: m.rating,
    view_count: m.view_count,
    description: m.description,
  }));

  res.json({ ...actor, filmography });
});

export default router;
