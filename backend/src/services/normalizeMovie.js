/**
 * Chuẩn hóa response từ Ophim v1, KKPhim (phimapi), Nguonc về cùng một format
 * để merge và lưu vào DB web phim.
 */

import { ophim as ophimUrls, phimapi as phimapiUrls } from '../config/crawlSources.js';

/** Chỉ chấp nhận URL ảnh hợp lệ (http/https), loại bỏ rỗng hoặc đường dẫn lỗi. Export để dùng khi lưu DB. */
export function sanitizeImageUrl(url) {
  if (url == null || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (!u.startsWith('http://') && !u.startsWith('https://')) return null;
  if (u.length > 2048) return null;
  if (/^\s*$/.test(u)) return null;
  return u;
}

/** Đưa URL ảnh về dạng absolute để hiển thị được khi crawl từ 3 nguồn */
function toAbsoluteImageUrl(url, base) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return sanitizeImageUrl(u) || null;
  if (u.startsWith('//')) return sanitizeImageUrl('https:' + u) || null;
  const b = (base || '').replace(/\/+$/, '');
  if (!b) return u.startsWith('/') ? 'https:' + u : u;
  const full = u.startsWith('/') ? b + u : b + '/' + u;
  return sanitizeImageUrl(full) || null;
}

/** Ophim CDN: path có thể là "uploads/xxx" hoặc "movies/xxx" hoặc "xxx" → tránh lặp uploads/uploads. Export để dùng trong crawlMerge. */
export function ophimImageUrl(cdn, path) {
  if (!path || typeof path !== 'string') return null;
  const p = path.trim().replace(/^\/+/, '');
  if (!p) return null;
  const c = (cdn || 'https://img.ophim.live').replace(/\/+$/, '');
  const lower = p.toLowerCase();
  if (lower.startsWith('uploads/')) return c + '/' + p;
  return c + '/uploads/' + p;
}

/** Ophim API trả thumb_url/poster_url dạng "slug-thumb.jpg" → CDN cần "movies/..." (uploads/movies/...). Export cho crawlMerge. */
export function ophimImagePath(path) {
  if (!path || typeof path !== 'string') return null;
  const p = path.trim().replace(/^\/+/, '');
  if (!p) return null;
  if (p.startsWith('http') || p.startsWith('uploads/') || p.startsWith('movies/')) return p;
  return 'movies/' + p;
}

/** Lấy số tập từ chuỗi kiểu "Hoàn tất (16/16)" hoặc "Tập 8" */
function parseTotalEpisodes(str) {
  if (!str || typeof str !== 'string') return 0;
  const m = str.match(/\((\d+)\/(\d+)\)/) || str.match(/(\d+)\s*\/\s*(\d+)/) || str.match(/(\d+)\s*Tập/);
  if (m) return parseInt(m[m.length - 1], 10) || 0;
  const n = str.match(/(\d+)/);
  return n ? parseInt(n[1], 10) : 0;
}

/** Lấy tập hiện tại từ chuỗi "Tập 8", "8", "8/12", "Hoàn tất (16/16)" → số hoặc null */
function parseEpisodeCurrent(val) {
  if (val == null) return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return Math.max(0, val);
  const str = String(val).trim();
  if (!str) return null;
  const pair = str.match(/(\d+)\s*\/\s*(\d+)/);
  if (pair) return parseInt(pair[1], 10) || null;
  const one = str.match(/(\d+)/);
  return one ? parseInt(one[1], 10) : null;
}

/** Parse duration (phút) từ API: số hoặc chuỗi số */
function parseDurationMinutes(val) {
  if (val == null) return null;
  if (typeof val === 'number' && !Number.isNaN(val) && val >= 0) return val;
  const n = parseInt(String(val).trim(), 10);
  return Number.isNaN(n) || n < 0 ? null : n;
}

/** Chuẩn type: single/movie -> movie, hoathinh -> anime, tvshows -> tvshows, series -> series */
function normalizeType(type) {
  if (!type) return 'movie';
  const t = String(type).toLowerCase();
  if (t === 'single' || t === 'movie') return 'movie';
  if (t === 'hoathinh') return 'anime';
  if (t === 'tvshows') return 'tvshows';
  if (t === 'series') return 'series';
  return 'movie';
}

/** true nếu lang_key chứa "tm" hoặc language/lang có "thuyết minh" / "thuyet minh" */
function hasThuyetMinh(langKey, langOrLanguage) {
  const arr = Array.isArray(langKey) ? langKey : (langKey != null && typeof langKey === 'string' ? [langKey] : []);
  if (arr.some((v) => String(v).toLowerCase().includes('tm'))) return true;
  const s = (langOrLanguage != null ? String(langOrLanguage) : '').toLowerCase();
  if (s.includes('thuyết minh') || s.includes('thuyet minh') || s.includes('+ tm') || s.includes('+tm')) return true;
  return false;
}

/**
 * Chuẩn hóa lang từ 3 nguồn API → lang_key: 'lt' | 'tm' | 'vs' (cho frontend hiển thị Lồng Tiếng / Thuyết Minh / Vietsub).
 * Tham số: lang_key (array hoặc string từ API), lang, language (chuỗi mô tả).
 */
export function normalizeLangKey(langKey, lang, language) {
  const raw = [langKey, lang, language].flatMap((v) => {
    if (v == null) return [];
    if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase().trim());
    return [String(v).toLowerCase().trim()];
  });
  const s = raw.join(' ');
  if (/^lt$|\blt\b|lồng\s*tiếng|long\s*tieng|loong\s*tieng/i.test(s)) return 'lt';
  if (/^tm$|\btm\b|thuyết\s*minh|thuyet\s*minh/i.test(s)) return 'tm';
  if (/^vs$|\bvs\b|vietsub|viet\s*sub|phụ\s*đề|phu\s*de|viet\s*sub/i.test(s)) return 'vs';
  return null;
}

/** Coi giá trị là true nếu API trả true, 1, "true", "1" (chiếu rạp) */
function isChieuRapTrue(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0 || val == null || val === '') return false;
  const s = String(val).toLowerCase().trim();
  return s === 'true' || s === '1';
}

/**
 * Ophim v1 API: response.data.item, response.data.APP_DOMAIN_CDN_IMAGE, data.seoOnPage (ảnh chuẩn)
 * Phim nổi bật dùng poster_url → poster; thumbnail dùng thumb_url. og_image thường là thumb nên không ưu tiên cho poster.
 */
export function normalizeOphim(apiResponse) {
  if (!apiResponse?.data?.item) return null;
  const data = apiResponse.data;
  const item = data.item;
  const cdn = (data.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live').replace(/\/+$/, '');

  const seoImageFull = data.seoOnPage?.seoSchema?.image;
  const seoOgPath = data.seoOnPage?.og_image?.[0];
  const fromSeoFull = sanitizeImageUrl(seoImageFull);
  const fromSeoOg = seoOgPath ? ophimImageUrl(cdn, String(seoOgPath).trim()) : null;

  const thumbFromItem = item.thumb_url ? (item.thumb_url.startsWith('http') ? sanitizeImageUrl(item.thumb_url) : ophimImageUrl(cdn, ophimImagePath(item.thumb_url))) : null;
  const posterFromItem = item.poster_url ? (item.poster_url.startsWith('http') ? sanitizeImageUrl(item.poster_url) : ophimImageUrl(cdn, ophimImagePath(item.poster_url))) : null;

  // Phim nổi bật bắt buộc dùng poster_url khi có; chỉ fallback seo/thumb khi không có poster_url.
  const poster = posterFromItem || fromSeoFull || fromSeoOg || thumbFromItem || null;
  const thumb = thumbFromItem || fromSeoFull || fromSeoOg || posterFromItem || null;

  let videoUrl = '';
  const episodes = Array.isArray(item.episodes) ? item.episodes : [];
  if (episodes.length > 0 && episodes[0].server_data?.length > 0) {
    videoUrl = episodes[0].server_data[0].link_embed || episodes[0].server_data[0].link_m3u8 || '';
  }
  // Phim lẻ: một số API trả link ở trường trực tiếp
  if (!videoUrl && (item.link_embed || item.video_url || item.link)) {
    videoUrl = (item.link_embed || item.video_url || item.link || '').trim();
  }

  return {
    source: 'ophim',
    slug: item.slug || null,
    title: item.name || '',
    title_en: item.origin_name || null,
    description: (item.content || '').trim() || null,
    poster: poster || null,
    backdrop: poster || null,
    thumbnail: thumb || poster || null,
    trailer_url: item.trailer_url || null,
    video_url: videoUrl,
    duration: null,
    release_year: item.year ? parseInt(item.year, 10) : null,
    type: normalizeType(item.type),
    country: item.country?.[0]?.name ?? null,
    quality: item.quality || null,
    language: item.lang || null,
    total_episodes: parseTotalEpisodes(item.episode_total || item.episode_current) || null,
    episode_current: item.episode_current || null,
    genres: (item.category || []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    countries: (item.country || []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    director: Array.isArray(item.director) ? item.director.filter(Boolean).join(', ') : (item.director || null),
    cast: Array.isArray(item.actor) ? item.actor : (item.actor ? [item.actor] : []),
    tmdb_id: item.tmdb_id ?? item.tmdb ?? item.movie_id ?? null,
    imdb_id: item.imdb_id ?? null,
    episodes,
    raw: null,
    chieu_rap: isChieuRapTrue(item.chieuRap ?? item.chieurap ?? item.chieu_rap),
    thuyet_minh: hasThuyetMinh(item.lang_key, item.lang),
    lang_key: normalizeLangKey(item.lang_key, item.lang, item.lang),
    status: (item.status === 'trailer' || item.status === 'sắp chiếu') ? 'trailer' : null,
  };
}

/**
 * KKPhim/PhimAPI: response.movie, response.episodes, status/msg
 * Lưu đúng tên API: poster = poster_url, thumbnail = thumb_url.
 * Phim nổi bật sẽ chọn ảnh theo source ở frontend: ophim → poster, phimapi → thumbnail.
 */
export function normalizePhimApi(apiResponse) {
  if (!apiResponse?.movie || apiResponse.status === false) return null;
  const movie = apiResponse.movie;
  const episodes = Array.isArray(apiResponse.episodes) ? apiResponse.episodes : [];
  const phimapiBase = 'https://phimapi.com';
  const poster = toAbsoluteImageUrl(movie.poster_url, phimapiBase) || toAbsoluteImageUrl(movie.thumb_url, phimapiBase) || null;
  const thumb = toAbsoluteImageUrl(movie.thumb_url, phimapiBase) || toAbsoluteImageUrl(movie.poster_url, phimapiBase) || null;

  let videoUrl = '';
  if (episodes.length > 0 && episodes[0].server_data?.length > 0) {
    videoUrl = episodes[0].server_data[0].link_embed || episodes[0].server_data[0].link_m3u8 || '';
  }
  // Phim lẻ: fallback từ trường trực tiếp
  if (!videoUrl && (movie.video_url || movie.link_embed || movie.link)) {
    videoUrl = (movie.video_url || movie.link_embed || movie.link || '').trim();
  }

  const year = movie.year ? parseInt(movie.year, 10) : null;
  const totalEps = parseTotalEpisodes(movie.episode_total || movie.episode_current || movie.tap_count) || (typeof movie.tap_count === 'number' ? movie.tap_count : null);
  const episodeCurrent = parseEpisodeCurrent(movie.episode_current);
  return {
    source: 'phimapi',
    slug: movie.slug || null,
    title: movie.name || '',
    title_en: movie.origin_name || null,
    description: (movie.content || '').trim() || null,
    poster: poster || thumb || null,
    backdrop: thumb || poster || null,
    thumbnail: thumb || poster || null,
    trailer_url: movie.trailer_url || null,
    video_url: videoUrl,
    duration: parseDurationMinutes(movie.time ?? movie.duration),
    release_year: year,
    type: normalizeType(movie.type),
    country: movie.country?.[0]?.name ?? null,
    quality: movie.quality || null,
    language: movie.lang || null,
    total_episodes: totalEps,
    episode_current: episodeCurrent,
    genres: (movie.category || []).map((c) => ({ id: c.id || c._id, name: c.name, slug: c.slug })),
    countries: (movie.country || []).map((c) => ({ id: c.id || c._id, name: c.name, slug: c.slug })),
    director: Array.isArray(movie.director) ? movie.director.filter(Boolean).join(', ') : (movie.director || null),
    cast: Array.isArray(movie.actor) ? movie.actor : (movie.actor ? [movie.actor] : []),
    tmdb_id: movie.tmdb_id ?? movie.tmdb ?? movie.movie_id ?? null,
    imdb_id: movie.imdb_id ?? null,
    episodes,
    raw: null,
    chieu_rap: isChieuRapTrue(movie.chieuRap ?? movie.chieurap ?? movie.chieu_rap),
    thuyet_minh: hasThuyetMinh(movie.lang_key, movie.lang),
    lang_key: normalizeLangKey(movie.lang_key, movie.lang, movie.lang),
    status: (movie.status === 'trailer' || movie.status === 'sắp chiếu') ? 'trailer' : null,
  };
}

/**
 * Nguonc: response.data hoặc response trực tiếp
 * Nguonc film detail: { status: "success", movie: {...} }. category có thể là mảng { group/list } hoặc object, hoặc dùng trường trực tiếp country/genre.
 */
export function normalizeNguonc(apiResponse) {
  const data = apiResponse?.data || apiResponse;
  const movie = data?.movie || data?.item;
  if (!movie) return null;

  const episodes = [];
  if (Array.isArray(movie.episodes)) {
    for (const ep of movie.episodes) {
      const serverData = (ep.items || ep.server_data || []).map((it) => ({
        name: it.name ?? it.slug,
        slug: it.slug ?? String(it.name),
        link_embed: it.embed ?? it.link_embed ?? '',
        link_m3u8: it.link_m3u8 ?? '',
      }));
      episodes.push({ server_name: ep.server_name || 'Nguồn', server_data: serverData });
    }
  }

  let videoUrl = '';
  if (episodes.length > 0 && episodes[0].server_data?.length > 0) {
    videoUrl = episodes[0].server_data[0].link_embed || '';
  }
  // Phim lẻ: fallback từ trường trực tiếp
  if (!videoUrl && (movie.video_url || movie.link_embed || movie.link)) {
    videoUrl = (movie.video_url || movie.link_embed || movie.link || '').trim();
  }

  const year =
    parseYearValue(movie.year) ??
    (movie.category && findYearFromCategories(movie.category)) ??
    (movie.categories && findYearFromCategories(movie.categories)) ??
    parseYearValue(movie.release_date ?? movie.release_year ?? movie.publish_year) ??
    null;

  function parseYearValue(v) {
    if (v == null) return null;
    if (typeof v === 'number' && !Number.isNaN(v)) return v >= 1900 && v <= 2100 ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    if (!Number.isNaN(n) && n >= 1900 && n <= 2100) return n;
    const match = s.match(/\b(19\d{2}|20\d{2})\b/);
    return match ? parseInt(match[1], 10) : null;
  }

  function findYearFromCategories(cats) {
    const groups = categoryToGroups(cats);
    for (const g of groups) {
      const groupName = (g?.group?.name ?? g?.name ?? '').toString().toLowerCase().trim();
      if (groupName !== 'năm') continue;
      const list = g.list || g.items || g.data || g;
      const arr = Array.isArray(list) ? list : (list != null ? [list] : []);
      const first = arr[0];
      if (first == null) return null;
      const y = first?.name ?? first?.title ?? first;
      if (typeof y === 'number') return y >= 1900 && y <= 2100 ? y : null;
      const parsed = parseYearValue(y);
      if (parsed != null) return parsed;
    }
    return null;
  }

  const type = inferNguoncType(movie);
  const categorySource = movie.category || movie.categories;
  let country = getFirstCountry(movie) ?? getCountryFromDirect(movie);
  let genres = listToGenres(categorySource, 'genre');
  if (!genres.length && (movie.genre || movie.genres)) {
    genres = parseGenreList(movie.genre || movie.genres);
  }

  const nguoncBase = 'https://phim.nguonc.com';
  const posterNguonc = toAbsoluteImageUrl(movie.poster_url || movie.thumb_url, nguoncBase);
  const backdropNguonc = toAbsoluteImageUrl(movie.thumb_url || movie.poster_url, nguoncBase);
  const posterFinal = posterNguonc || backdropNguonc || null;
  const backdropFinal = backdropNguonc || posterNguonc || null;

  return {
    source: 'nguonc',
    slug: movie.slug || null,
    title: movie.name || '',
    title_en: movie.original_name || movie.origin_name || null,
    description: (movie.description || movie.content || '').trim() || null,
    poster: posterFinal,
    backdrop: backdropFinal,
    thumbnail: backdropNguonc || posterFinal || null,
    trailer_url: movie.trailer_url || null,
    video_url: videoUrl,
    duration: null,
    release_year: year != null ? (typeof year === 'number' ? year : parseInt(year, 10)) : null,
    type: normalizeType(type),
    country: country || null,
    quality: movie.quality || null,
    language: movie.language || movie.lang || null,
    total_episodes: movie.total_episodes ?? parseTotalEpisodes(movie.current_episode) ?? null,
    episode_current: movie.current_episode || null,
    genres,
    countries: listToGenres(categorySource, 'country'),
    director: movie.director || null,
    cast: movie.casts ? (typeof movie.casts === 'string' ? movie.casts.split(',').map((s) => s.trim()) : movie.casts) : [],
    tmdb_id: movie.tmdb_id ?? movie.tmdb ?? movie.movie_id ?? null,
    imdb_id: movie.imdb_id ?? null,
    episodes,
    raw: null,
    chieu_rap: isChieuRapTrue(movie.chieuRap ?? movie.chieurap ?? movie.chieu_rap),
    thuyet_minh: hasThuyetMinh(movie.lang_key, movie.language || movie.lang),
    lang_key: normalizeLangKey(movie.lang_key, movie.lang, movie.language),
    status: (movie.status === 'trailer' || movie.status === 'sắp chiếu') ? 'trailer' : null,
  };
}

/** Lấy quốc gia từ trường trực tiếp (string hoặc mảng) nếu category không có */
function getCountryFromDirect(movie) {
  if (!movie) return null;
  if (typeof movie.country === 'string' && movie.country.trim()) return movie.country.trim();
  if (Array.isArray(movie.country) && movie.country.length) {
    const first = movie.country[0];
    return typeof first === 'string' ? first : (first?.name || null);
  }
  if (movie.country_name && typeof movie.country_name === 'string') return movie.country_name.trim();
  if (Array.isArray(movie.countries) && movie.countries.length) {
    const first = movie.countries[0];
    return typeof first === 'string' ? first : (first?.name || null);
  }
  return null;
}

/** Parse thể loại từ mảng chuỗi hoặc mảng object { name, slug } khi không có category nhóm */
function parseGenreList(genreOrGenres) {
  const arr = Array.isArray(genreOrGenres) ? genreOrGenres : (genreOrGenres ? [genreOrGenres] : []);
  const out = [];
  for (const x of arr) {
    if (typeof x === 'string' && x.trim()) {
      out.push({ id: null, name: x.trim(), slug: x.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') });
    } else if (x && typeof x === 'object' && (x.name || x.title)) {
      const name = (x.name || x.title || '').trim();
      if (name) out.push({ id: x.id || null, name, slug: (x.slug || name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') });
    }
  }
  return out;
}

function inferNguoncType(movie) {
  const groups = categoryToGroups(movie?.category || movie?.categories);
  for (const g of groups) {
    const list = g.list || g.items || g.data || g;
    const arr = Array.isArray(list) ? list : (list != null ? [list] : []);
    for (const x of arr) {
      const name = (x?.name ?? x?.title ?? '').toString().toLowerCase().trim();
      if (name.includes('hoạt hình') || name.includes('hoathinh')) return 'hoathinh';
      if (name.includes('phim lẻ') || name.includes('single')) return 'single';
      if (name === 'tv shows' || name === 'tvshows' || (name.includes('tv show') && !name.includes('phim'))) return 'tvshows';
      if (name.includes('tv') || name.includes('tvshows')) return 'tvshows';
    }
  }
  return 'series';
}

/** Chuẩn hóa category (mảng hoặc object kiểu Nguonc {"1":{group,list},...}) thành mảng groups. */
function categoryToGroups(cats) {
  if (!cats || typeof cats !== 'object') return [];
  if (Array.isArray(cats)) return cats;
  return Object.values(cats).map((v) => ({
    group: v?.group || { name: v?.name },
    name: v?.group?.name ?? v?.name,
    list: v?.list ?? v?.items ?? v?.data ?? [],
  }));
}

function getFirstCountry(movie) {
  const groups = categoryToGroups(movie?.category || movie?.categories);
  for (const g of groups) {
    const name = (g?.group?.name || g?.name || '').toLowerCase();
    if (name.includes('quốc gia') || name === 'country') {
      const list = g.list || g.items || g.data || [];
      const arr = Array.isArray(list) ? list : [list];
      const first = arr[0];
      if (first != null) return typeof first === 'string' ? first : (first?.name ?? null);
      return null;
    }
  }
  return null;
}

function listToGenres(category, kind) {
  const cats = categoryToGroups(category);
  if (!cats.length) return [];
  const out = [];
  for (const g of cats) {
    const groupName = (g?.group?.name || g?.name || '').toLowerCase();
    const isCountry = groupName.includes('quốc gia') || groupName === 'country';
    const isYear = groupName.includes('năm');
    const isFormat = groupName.includes('định dạng');
    if (kind === 'country' && !isCountry) continue;
    if (kind === 'genre' && (isCountry || isYear || isFormat)) continue;
    const list = g.list || g.items || g.data || g;
    const arr = Array.isArray(list) ? list : (list && typeof list === 'object' ? [list] : []);
    for (const x of arr) {
      const name = x?.name ?? x?.title ?? (typeof x === 'string' ? x : null);
      if (!name) continue;
      const n = typeof name === 'string' ? name.trim() : String(name).trim();
      if (!n) continue;
      out.push({ id: x.id || null, name: n, slug: (x.slug || n).toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') });
    }
  }
  return out;
}

/**
 * Merge dữ liệu từ nhiều nguồn: ưu tiên primary, bổ sung từ secondary khi thiếu.
 */
export function mergeMovieData(primary, ...secondaries) {
  const out = { ...primary };
  for (const s of secondaries) {
    if (!s) continue;
    if (!out.description && s.description) out.description = s.description;
    if (!out.trailer_url && s.trailer_url) out.trailer_url = s.trailer_url;
    if (!out.video_url && s.video_url) out.video_url = s.video_url;
    if (!out.director && s.director) out.director = s.director;
    if (!out.tmdb_id && s.tmdb_id) out.tmdb_id = s.tmdb_id;
    if (!out.imdb_id && s.imdb_id) out.imdb_id = s.imdb_id;
    if (!out.quality && s.quality) out.quality = s.quality;
    if (!out.language && s.language) out.language = s.language;
    if (!out.lang_key && s.lang_key) out.lang_key = s.lang_key;
    if ((!out.total_episodes || out.total_episodes === 0) && s.total_episodes) out.total_episodes = s.total_episodes;
    if (!out.poster && s.poster) out.poster = s.poster;
    if (!out.backdrop && s.backdrop) out.backdrop = s.backdrop;
    if (!out.thumbnail && s.thumbnail) out.thumbnail = s.thumbnail;
    if (out.chieu_rap !== true && isChieuRapTrue(s.chieu_rap)) out.chieu_rap = true;
    if (out.chieu_rap !== true && isChieuRapTrue(s.chieuRap)) out.chieu_rap = true;
    if (out.thuyet_minh !== true && s.thuyet_minh === true) out.thuyet_minh = true;
    if (out.status !== 'trailer' && s.status === 'trailer') out.status = 'trailer';
    if (Array.isArray(out.cast) && Array.isArray(s.cast) && out.cast.length < s.cast.length) out.cast = s.cast;
    if (Array.isArray(out.genres) && Array.isArray(s.genres) && out.genres.length < s.genres.length) out.genres = s.genres;
    if (Array.isArray(out.episodes) && Array.isArray(s.episodes)) {
      const existingNames = new Set(out.episodes.map((e) => e.server_name));
      for (const ep of s.episodes) {
        if (!existingNames.has(ep.server_name)) {
          out.episodes.push(ep);
          existingNames.add(ep.server_name);
        }
      }
    }
  }
  return out;
}
