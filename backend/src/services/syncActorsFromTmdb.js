/**
 * Đồng bộ diễn viên từ TMDB: GET /person/{id} + GET /person/{id}/images.
 * Dùng cho admin endpoint và có thể gọi từ script.
 */
import db from '../config/db.js';
import { slugify } from '../utils/slugify.js';
import { fetchTmdbPersonWithAvatar } from './tmdbCredits.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function collectTmdbPersonIds() {
  const ids = new Set();
  const fromActors = db.prepare('SELECT tmdb_id FROM actors WHERE tmdb_id IS NOT NULL').all();
  fromActors.forEach((r) => ids.add(Number(r.tmdb_id)));
  const movies = db.prepare('SELECT id, "cast" FROM movies').all();
  for (const m of movies) {
    let cast = [];
    try {
      cast = JSON.parse(m.cast || '[]');
    } catch (_) {}
    if (!Array.isArray(cast)) continue;
    for (const entry of cast) {
      const id = typeof entry === 'object' && entry && entry.id != null ? Number(entry.id) : null;
      if (id && !Number.isNaN(id)) ids.add(id);
    }
  }
  return [...ids];
}

export function upsertActorFromTmdb(person) {
  if (!person || !person.name) return;
  const name = person.name.trim();
  const slug = slugify(name) || name.toLowerCase().replace(/\s+/g, '-');
  const avatar = person.avatar && person.avatar.startsWith('http') ? person.avatar : null;
  const existing = db.prepare('SELECT id FROM actors WHERE tmdb_id = ?').get(person.tmdb_id);
  if (existing) {
    db.prepare(`
      UPDATE actors SET name = ?, slug = ?, avatar = ?, biography = ?, other_names = ?, gender = ?, birthday = ?, place_of_birth = ?, tmdb_id = ?
      WHERE id = ?
    `).run(
      name,
      slug,
      avatar,
      person.biography ?? null,
      person.other_names ?? null,
      person.gender ?? null,
      person.birthday ?? null,
      person.place_of_birth ?? null,
      person.tmdb_id,
      existing.id
    );
    return;
  }
  const byName = db.prepare('SELECT id FROM actors WHERE name = ?').get(name);
  if (byName) {
    db.prepare(`
      UPDATE actors SET slug = ?, avatar = ?, biography = ?, other_names = ?, gender = ?, birthday = ?, place_of_birth = ?, tmdb_id = ?
      WHERE id = ?
    `).run(
      slug,
      avatar,
      person.biography ?? null,
      person.other_names ?? null,
      person.gender ?? null,
      person.birthday ?? null,
      person.place_of_birth ?? null,
      person.tmdb_id,
      byName.id
    );
    return;
  }
  const bySlug = db.prepare('SELECT id FROM actors WHERE slug = ?').get(slug);
  if (bySlug) {
    db.prepare(`
      UPDATE actors SET name = ?, avatar = ?, biography = ?, other_names = ?, gender = ?, birthday = ?, place_of_birth = ?, tmdb_id = ?
      WHERE id = ?
    `).run(
      name,
      avatar,
      person.biography ?? null,
      person.other_names ?? null,
      person.gender ?? null,
      person.birthday ?? null,
      person.place_of_birth ?? null,
      person.tmdb_id,
      bySlug.id
    );
    return;
  }
  db.prepare(`
    INSERT INTO actors (name, slug, avatar, biography, other_names, gender, birthday, place_of_birth, tmdb_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    slug,
    avatar,
    person.biography ?? null,
    person.other_names ?? null,
    person.gender ?? null,
    person.birthday ?? null,
    person.place_of_birth ?? null,
    person.tmdb_id
  );
}

/**
 * Đồng bộ tối đa `limit` diễn viên từ TMDB. Trả về { updated, errors, total }.
 */
export async function syncActorsFromTmdb(limit = 100) {
  if (!process.env.TMDB_API_KEY) {
    return { updated: 0, errors: 0, total: 0, error: 'Thiếu TMDB_API_KEY' };
  }
  const ids = collectTmdbPersonIds();
  const toProcess = ids.slice(0, Math.max(1, limit));
  let updated = 0;
  let errors = 0;
  for (const tmdbId of toProcess) {
    try {
      const person = await fetchTmdbPersonWithAvatar(tmdbId);
      if (person) {
        person.tmdb_id = tmdbId;
        upsertActorFromTmdb(person);
        updated++;
      }
      await delay(260);
    } catch (_) {
      errors++;
    }
  }
  return { updated, errors, total: ids.length };
}
