import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getAiSuggestions, askAi } from '../services/aiRecommend.js';

const router = Router();

function getMoviesByIds(ids) {
  const unique = ids ? [...new Set(ids)] : [];
  if (unique.length === 0) return [];
  const placeholders = unique.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT m.*, GROUP_CONCAT(DISTINCT g.name) as genres, GROUP_CONCAT(DISTINCT g.id) as genre_ids
    FROM movies m
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    WHERE m.id IN (${placeholders}) AND (m.status IS NULL OR m.status = 'published')
    GROUP BY m.id
  `).all(...unique);
  const order = unique.reduce((acc, id, i) => { acc[id] = i; return acc; }, {});
  rows.sort((a, b) => (order[a.id] ?? 99) - (order[b.id] ?? 99));
  return rows.map((m) => ({
    ...m,
    genres: m.genres ? m.genres.split(',') : [],
    genre_ids: m.genre_ids ? m.genre_ids.split(',').map(Number) : [],
  }));
}

// AI personalization: recommend based on watch history + favorites + genre affinity
router.get('/for-you', requireAuth, (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 12, 24);

  // Get user's watched movie IDs and their genres
  const watched = db.prepare(`
    SELECT DISTINCT wh.movie_id, m.rating
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = ?
    ORDER BY wh.watched_at DESC
    LIMIT 50
  `).all(userId);

  const favoriteGenreIds = db.prepare(`
    SELECT genre_id, COUNT(*) as cnt FROM movie_genres mg
    JOIN user_favorites uf ON uf.movie_id = mg.movie_id
    WHERE uf.user_id = ?
    GROUP BY genre_id ORDER BY cnt DESC LIMIT 5
  `).all(userId);

  const watchedIds = watched.map((r) => r.movie_id);
  const placeholders = watchedIds.length ? watchedIds.map(() => '?').join(',') : '0';
  const excludeIds = watchedIds.length ? watchedIds : [0];

  // Same genres as watched/favorites, not yet watched, ordered by rating
  const genreWeights = favoriteGenreIds.map((g) => g.genre_id);
  let recommended = [];

  if (genreWeights.length > 0) {
    const genrePlaceholders = genreWeights.map(() => '?').join(',');
    recommended = db.prepare(`
      SELECT m.*, GROUP_CONCAT(DISTINCT g.name) as genres
      FROM movies m
      JOIN movie_genres mg ON m.id = mg.movie_id AND mg.genre_id IN (${genrePlaceholders})
      LEFT JOIN movie_genres mg2 ON m.id = mg2.movie_id
      LEFT JOIN genres g ON mg2.genre_id = g.id
      WHERE m.id NOT IN (${placeholders})
      GROUP BY m.id
      ORDER BY m.rating DESC, m.view_count DESC
      LIMIT ?
    `).all(...genreWeights, ...excludeIds, limit);
  }

  if (recommended.length < limit) {
    const haveIds = new Set([...excludeIds, ...recommended.map((m) => m.id)]);
    const more = db.prepare(`
      SELECT m.*, GROUP_CONCAT(DISTINCT g.name) as genres
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.id NOT IN (${haveIds.size ? Array.from(haveIds).map(() => '?').join(',') : '0'})
      GROUP BY m.id
      ORDER BY m.rating DESC, m.view_count DESC
      LIMIT ?
    `).all(...(haveIds.size ? Array.from(haveIds) : []), limit - recommended.length);
    recommended = [...recommended, ...more];
  }

  const movies = recommended.slice(0, limit).map((m) => ({
    ...m,
    genres: m.genres ? m.genres.split(',') : [],
  }));

  res.json({ movies });
});

// AI gợi ý phim theo mood + lọc (ChatGPT)
router.post('/ai-suggest', async (req, res) => {
  try {
    const { mood, genreId, country, type, era } = req.body || {};
    const genres = db.prepare('SELECT id, name FROM genres ORDER BY name').all();
    const ids = await getAiSuggestions({
      mood: mood || undefined,
      genreId: genreId || undefined,
      country: country || undefined,
      type: type || undefined,
      era: era || undefined,
      genres,
    });
    const movies = getMoviesByIds(ids);
    res.json({ movies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi gợi ý AI' });
  }
});

// Hỏi AI về phim (câu hỏi tự do)
router.post('/ai-ask', async (req, res) => {
  try {
    const question = req.body?.question?.trim();
    const { answer, movieIds } = await askAi(question || '', []);
    const movies = getMoviesByIds(movieIds || []);
    res.json({ answer, movies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi hỏi AI' });
  }
});

export default router;
