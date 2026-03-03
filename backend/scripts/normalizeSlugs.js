/**
 * Script một lần: chuẩn hóa slug phim, diễn viên, đạo diễn trong DB sang dạng không dấu (slugify).
 * Trùng slug: phim thêm hậu tố -2, -3...; actors/directors dùng slugify(name) (UNIQUE trong DB).
 * Chạy từ thư mục backend: node scripts/normalizeSlugs.js
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { slugify } from '../src/utils/slugify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/phim.db');
const db = new Database(dbPath);

let updated = 0;

// Movies: slug từ title; nếu trùng slug thì thêm -2, -3...
const movies = db.prepare('SELECT id, title, slug FROM movies ORDER BY id').all();
const updateMovie = db.prepare('UPDATE movies SET slug = ? WHERE id = ?');
const usedMovieSlugs = new Set();
for (const m of movies) {
  const base = slugify(m.title) || String(m.id);
  let slug = base;
  let n = 2;
  while (usedMovieSlugs.has(slug) && slug !== (m.slug || '').trim()) {
    slug = `${base}-${n}`;
    n += 1;
  }
  usedMovieSlugs.add(slug);
  const current = (m.slug || '').trim();
  if (current !== slug) {
    try {
      updateMovie.run(slug, m.id);
      updated += 1;
      console.log(`Movie ${m.id} "${m.title}": ${current || '(empty)'} -> ${slug}`);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        slug = `${base}-${m.id}`;
        updateMovie.run(slug, m.id);
        updated += 1;
        console.log(`Movie ${m.id} (duplicate): -> ${slug}`);
      } else throw e;
    }
  }
}

// Actors
const actors = db.prepare('SELECT id, name, slug FROM actors ORDER BY id').all();
const updateActor = db.prepare('UPDATE actors SET slug = ? WHERE id = ?');
for (const a of actors) {
  const canonical = slugify(a.name);
  if (!canonical) continue;
  const current = (a.slug || '').trim();
  if (current !== canonical) {
    try {
      updateActor.run(canonical, a.id);
      updated += 1;
      console.log(`Actor ${a.id} "${a.name}": ${current || '(empty)'} -> ${canonical}`);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        const fallback = `${canonical}-${a.id}`;
        updateActor.run(fallback, a.id);
        updated += 1;
        console.log(`Actor ${a.id} (duplicate): -> ${fallback}`);
      } else throw e;
    }
  }
}

// Directors
try {
  const directors = db.prepare('SELECT id, name, slug FROM directors ORDER BY id').all();
  const updateDirector = db.prepare('UPDATE directors SET slug = ? WHERE id = ?');
  for (const d of directors) {
    const canonical = slugify(d.name);
    if (!canonical) continue;
    const current = (d.slug || '').trim();
    if (current !== canonical) {
      try {
        updateDirector.run(canonical, d.id);
        updated += 1;
        console.log(`Director ${d.id} "${d.name}": ${current || '(empty)'} -> ${canonical}`);
      } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) {
          const fallback = `${canonical}-${d.id}`;
          updateDirector.run(fallback, d.id);
          updated += 1;
          console.log(`Director ${d.id} (duplicate): -> ${fallback}`);
        } else throw e;
      }
    }
  }
} catch (e) {
  if (!e.message || !e.message.includes('no such table')) console.error('Directors:', e.message);
}

db.close();
console.log(`Done. Updated ${updated} slug(s).`);
