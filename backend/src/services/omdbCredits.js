/**
 * Lấy Director và Actors từ OMDb API (dữ liệu IMDb).
 * OMDb không trả ảnh profile; dùng để bổ sung tên khi TMDB thiếu hoặc kết hợp cả hai.
 * Cần OMDb API key: https://www.omdbapi.com/apikey.aspx
 */

const OMDb_BASE = 'https://www.omdbapi.com';

/**
 * Chuẩn hóa imdb_id (chấp nhận tt1234567 hoặc 1234567).
 */
function normalizeImdbId(imdbId) {
  if (!imdbId) return null;
  const s = String(imdbId).trim();
  if (/^tt\d+$/.test(s)) return s;
  if (/^\d+$/.test(s)) return `tt${s}`;
  return null;
}

/**
 * Gọi OMDb theo IMDb ID. Trả về { Director, Actors } hoặc null.
 */
export async function fetchOmdbByImdbId(imdbId) {
  const key = process.env.OMDB_API_KEY;
  const id = normalizeImdbId(imdbId);
  if (!key || !id) return null;
  try {
    const url = `${OMDb_BASE}/?apikey=${key}&i=${encodeURIComponent(id)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === 'False' || !data) return null;
    return {
      Director: data.Director || '',
      Actors: data.Actors || '',
    };
  } catch {
    return null;
  }
}

/**
 * Tìm phim OMDb theo tên (và năm), trả về imdb_id (tt...) hoặc null.
 */
export async function searchOmdbByTitle(title, year = null) {
  const key = process.env.OMDB_API_KEY;
  if (!key || !title || typeof title !== 'string') return null;
  const q = title.trim().replace(/\s+/g, ' ');
  if (!q) return null;
  try {
    let url = `${OMDb_BASE}/?apikey=${key}&t=${encodeURIComponent(q)}`;
    if (year) url += `&y=${encodeURIComponent(String(year))}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === 'False' || !data || !data.imdbID) return null;
    return data.imdbID; // tt1234567
  } catch {
    return null;
  }
}

/**
 * Parse Director và Actors từ OMDb response thành dạng dùng chung.
 * OMDb không có ảnh → avatar luôn null.
 * Trả về { directors: { name, avatar: null }[], cast: { name, avatar: null }[] }
 */
export function parseOmdbCredits(omdbData) {
  if (!omdbData) return { directors: [], cast: [] };
  const directors = (omdbData.Director || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, avatar: null }));
  const cast = (omdbData.Actors || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((name) => ({ name, avatar: null }));
  return { directors, cast };
}
