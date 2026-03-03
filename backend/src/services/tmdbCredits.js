/**
 * Lấy cast và crew (đạo diễn) từ TMDB API khi có tmdb_id.
 * Bổ sung: GET /person/{person_id} và /person/{person_id}/images để lấy thông tin + ảnh diễn viên/đạo diễn.
 * Cần TMDB_API_KEY trong .env.
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/** Build URL ảnh profile TMDB (size: w185, w342, original) */
export function tmdbProfileImageUrl(profilePath, size = 'w185') {
  if (!profilePath || typeof profilePath !== 'string') return null;
  const path = profilePath.startsWith('/') ? profilePath : `/${profilePath}`;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * GET /person/{person_id} - thông tin diễn viên/đạo diễn (name, biography, birthday, profile_path, ...)
 */
async function safeJson(res) {
  const text = await res.text();
  if (!text || text.trim() === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function fetchTmdbPerson(personId) {
  const key = process.env.TMDB_API_KEY;
  if (!key || personId == null) return null;
  const id = Number(personId) || String(personId);
  const url = `${TMDB_BASE}/person/${id}?api_key=${key}&language=vi-VN`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return safeJson(res);
  } catch {
    return null;
  }
}

/**
 * GET /person/{person_id}/images - danh sách ảnh profile (profiles[].file_path, vote_count, vote_average)
 */
export async function fetchTmdbPersonImages(personId) {
  const key = process.env.TMDB_API_KEY;
  if (!key || personId == null) return null;
  const id = Number(personId) || String(personId);
  const url = `${TMDB_BASE}/person/${id}/images?api_key=${key}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return safeJson(res);
  } catch {
    return null;
  }
}

/**
 * Chọn ảnh profile tốt nhất từ response /person/{id}/images (ưu tiên vote_count, sau đó vote_average).
 */
export function getBestProfileFromImages(imagesResponse, size = 'w185') {
  const profiles = imagesResponse?.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) return null;
  const sorted = [...profiles].sort((a, b) => {
    const vA = a.vote_count ?? 0;
    const vB = b.vote_count ?? 0;
    if (vB !== vA) return vB - vA;
    return (b.vote_average ?? 0) - (a.vote_average ?? 0);
  });
  const best = sorted[0];
  const path = best?.file_path;
  return path ? tmdbProfileImageUrl(path, size) : null;
}

/**
 * Lấy thông tin + ảnh tốt nhất cho một person: gọi /person/{id} và /person/{id}/images.
 * Ảnh dùng base URL https://image.tmdb.org/t/p (tmdbProfileImageUrl).
 * Trả về { name, avatar, biography, birthday, place_of_birth, other_names, gender } hoặc null.
 */
export async function fetchTmdbPersonWithAvatar(personId) {
  const [person, images] = await Promise.all([
    fetchTmdbPerson(personId),
    fetchTmdbPersonImages(personId),
  ]);
  if (!person || !person.name) return null;
  const avatar =
    getBestProfileFromImages(images) ||
    (person.profile_path ? tmdbProfileImageUrl(person.profile_path, 'w185') : null);
  const alsoKnownAs = person.also_known_as;
  const otherNames = Array.isArray(alsoKnownAs) && alsoKnownAs.length > 0
    ? alsoKnownAs.map((s) => (s || '').trim()).filter(Boolean).join(', ')
    : null;
  const gender = person.gender != null ? person.gender : null; // 0 unknown, 1 female, 2 male
  return {
    name: (person.name || '').trim(),
    avatar: avatar || null,
    biography: (person.biography || '').trim() || null,
    birthday: person.birthday || null,
    place_of_birth: person.place_of_birth || null,
    other_names: otherNames || null,
    gender,
  };
}

/**
 * Tìm phim trên TMDB theo tên (và năm) để lấy tmdb_id khi nguồn crawl không có.
 * Trả về { id, type: 'movie'|'tv' } hoặc null.
 */
export async function searchTmdbByTitle(title, year = null, preferType = 'movie') {
  const key = process.env.TMDB_API_KEY;
  if (!key || !title || typeof title !== 'string') return null;
  const q = title.trim().replace(/\s+/g, ' ');
  if (!q) return null;
  try {
    const searchMovie = `${TMDB_BASE}/search/movie?api_key=${key}&query=${encodeURIComponent(q)}&language=vi-VN`;
    const searchTv = `${TMDB_BASE}/search/tv?api_key=${key}&query=${encodeURIComponent(q)}&language=vi-VN`;
    const [movieRes, tvRes] = await Promise.all([fetch(searchMovie), fetch(searchTv)]);
    const movieData = movieRes.ok ? await movieRes.json() : null;
    const tvData = tvRes.ok ? await tvRes.json() : null;
    const movieResults = movieData?.results || [];
    const tvResults = tvData?.results || [];
    const yearNum = year ? parseInt(year, 10) : null;

    const pick = (list, type) => {
      for (const item of list) {
        const date = item.release_date || item.first_air_date || '';
        const itemYear = date ? parseInt(date.slice(0, 4), 10) : null;
        if (!yearNum || itemYear === yearNum || Math.abs((itemYear || 0) - yearNum) <= 1) {
          return { id: item.id, type };
        }
        if (!yearNum) return { id: item.id, type };
      }
      return list[0] ? { id: list[0].id, type } : null;
    };

    if (preferType === 'tv' || preferType === 'series' || preferType === 'anime') {
      const tv = pick(tvResults, 'tv');
      if (tv) return tv;
      return pick(movieResults, 'movie');
    }
    const movie = pick(movieResults, 'movie');
    if (movie) return movie;
    return pick(tvResults, 'tv');
  } catch {
    return null;
  }
}

export async function fetchTmdbCredits(tmdbId, type = 'movie') {
  const key = process.env.TMDB_API_KEY;
  if (!key || !tmdbId) return null;
  const endpoint = type === 'tv' || type === 'series' || type === 'anime'
    ? `${TMDB_BASE}/tv/${tmdbId}/credits`
    : `${TMDB_BASE}/movie/${tmdbId}/credits`;
  const url = `${endpoint}?api_key=${key}&language=vi-VN`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404 && (type === 'movie' || !type)) {
        const tvUrl = `${TMDB_BASE}/tv/${tmdbId}/credits?api_key=${key}&language=vi-VN`;
        const tvRes = await fetch(tvUrl);
        if (tvRes.ok) return tvRes.json();
      }
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Trả về { directors: { id?, name, profile_path?, avatar? }[], cast: { id?, name, profile_path?, avatar? }[] }
 * id = TMDB person_id để gọi /person/{id} và /person/{id}/images lấy thông tin + ảnh tốt hơn.
 * avatar = full URL ảnh từ credits (fallback); ưu tiên dùng fetchTmdbPersonWithAvatar(id) khi import.
 */
export function parseTmdbCredits(credits) {
  if (!credits) return { directors: [], cast: [] };
  const directorMap = new Map();
  const crew = credits.crew || [];
  const isDirectorJob = (job) => {
    if (!job || typeof job !== 'string') return false;
    const j = job.toLowerCase();
    return j === 'director' || j === 'directing' || j.includes('director');
  };
  for (const c of crew) {
    if (isDirectorJob(c.job) && c.name) {
      const name = c.name.trim();
      if (!directorMap.has(name)) {
        directorMap.set(name, {
          id: c.id ?? null,
          name,
          profile_path: c.profile_path || null,
          avatar: c.profile_path ? tmdbProfileImageUrl(c.profile_path, 'w185') : null,
        });
      }
    }
  }
  const directors = [...directorMap.values()];

  const cast = (credits.cast || [])
    .slice(0, 30)
    .map((c) => {
      const name = (c.name || c.character || '').trim();
      if (!name) return null;
      return {
        id: c.id ?? null,
        name,
        profile_path: c.profile_path || null,
        avatar: c.profile_path ? tmdbProfileImageUrl(c.profile_path, 'w185') : null,
      };
    })
    .filter(Boolean);

  return { directors, cast };
}
