/**
 * Gọi 3 nguồn (Ophim, KKPhim, Nguonc), chuẩn hóa và merge thành một bản ghi phim.
 * Ưu tiên nguồn KKPhim (phimapi): primary và metadata lấy từ KKPhim khi có; gộp đủ server cả 3 nguồn.
 */

import { ophim as ophimUrls, phimapi as phimapiUrls, nguonc as nguoncUrls } from '../config/crawlSources.js';
import { fetchOphim, fetchPhimApi, fetchNguonc } from './crawlFetch.js';
import { normalizeOphim, normalizePhimApi, normalizeNguonc, mergeMovieData, normalizeLangKey, ophimImageUrl, ophimImagePath } from './normalizeMovie.js';

/** So sánh title gần đúng để match phim cùng tên giữa các nguồn */
function titleMatches(a, b) {
  if (!a || !b) return false;
  const n = (s) => String(s).toLowerCase().trim().normalize('NFD').replace(/\p{M}/gu, '');
  const na = n(a);
  const nb = n(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Cùng một bộ phim (cùng production): trùng slug nhưng khác type/năm thì không gộp server
 * VD: trach-thien-ky ở PhimAPI = hoạt hình 2026, ở Ophim = phim bộ 2017 → không gộp.
 */
function isSameProduction(primary, source) {
  if (!primary || !source) return false;
  const typeA = String(primary.type || '').toLowerCase().trim();
  const typeB = String(source.type || '').toLowerCase().trim();
  if (typeA !== typeB) return false;
  const yearA = primary.release_year ?? primary.year;
  const yearB = source.release_year ?? source.year;
  if (yearA != null && yearB != null && Number(yearA) !== Number(yearB)) return false;
  const tmdbA = primary.tmdb?.id ?? primary.tmdb_id;
  const tmdbB = source.tmdb?.id ?? source.tmdb_id;
  if (tmdbA != null && tmdbB != null && String(tmdbA) !== String(tmdbB)) return false;
  return true;
}

/** Tìm cùng một phim trên nguồn bằng search title (+ year), rồi lấy chi tiết theo slug trả về. */
async function findSameMovieOnSource(source, title, year) {
  const t = (title || '').trim();
  if (!t) return null;
  const y = year ? parseInt(year, 10) : null;
  if (source === 'ophim') {
    const res = await fetchOphim(ophimUrls.search(t));
    const items = res?.data?.items || [];
    for (const it of items) {
      const itemYear = it.year ? parseInt(it.year, 10) : null;
      if (y != null && itemYear != null && y !== itemYear) continue;
      if (!titleMatches(it.name, t)) continue;
      const full = await fetchOphim(ophimUrls.phim(it.slug));
      if (full?.data?.item) return normalizeOphim(full);
      return null;
    }
    return null;
  }
  if (source === 'phimapi') {
    const res = await fetchPhimApi(phimapiUrls.timKiem(t, { page: 1 }));
    const items = res?.data?.items || [];
    for (const it of items) {
      const itemYear = it.year ? parseInt(it.year, 10) : null;
      if (y != null && itemYear != null && y !== itemYear) continue;
      if (!titleMatches(it.name, t)) continue;
      const full = await fetchPhimApi(phimapiUrls.phim(it.slug));
      if (full?.movie && full.status !== false) return normalizePhimApi(full);
      return null;
    }
    return null;
  }
  if (source === 'nguonc') {
    const res = await fetchNguonc(nguoncUrls.search(t));
    const items = res?.items || [];
    for (const it of items) {
      const itemYear = it.year ? parseInt(it.year, 10) : null;
      if (y != null && itemYear != null && y !== itemYear) continue;
      if (!titleMatches(it.name, t)) continue;
      const slug = it.slug || it.slug_url;
      if (!slug) continue;
      const full = await fetchNguonc(nguoncUrls.film(slug));
      if (full?.movie) return normalizeNguonc({ status: 'success', movie: full.movie });
      return null;
    }
    return null;
  }
  return null;
}

/**
 * Lấy chi tiết phim theo slug: gọi 3 nguồn bằng slug; nếu thiếu nguồn thì tìm theo title+năm để gộp đủ server.
 * Metadata ưu tiên Ophim; server và link chỉ gộp nguồn cùng production (cùng type + year/tmdb), trùng slug khác phim thì bỏ qua.
 */
export async function getMovieBySlug(slug) {
  const [ophimRes, phimapiRes, nguoncRes] = await Promise.all([
    fetchOphim(ophimUrls.phim(slug)),
    fetchPhimApi(phimapiUrls.phim(slug)),
    fetchNguonc(nguoncUrls.film(slug)),
  ]);

  let primary = null;
  let secondary1 = null;
  let secondary2 = null;

  // Ưu tiên KKPhim (phimapi) làm primary khi có
  if (phimapiRes?.movie && phimapiRes.status !== false) {
    primary = normalizePhimApi(phimapiRes);
  }
  if (ophimRes?.data?.item) {
    const n = normalizeOphim(ophimRes);
    if (!primary) primary = n;
    else secondary1 = n;
  }
  if (nguoncRes?.movie) {
    const n = normalizeNguonc({ status: 'success', movie: nguoncRes.movie });
    if (n) {
      if (!primary) primary = n;
      else (secondary1 ? (secondary2 = n) : (secondary1 = n));
    }
  }

  // Cùng một phim nhưng slug khác nhau: tìm thêm trên nguồn còn thiếu để gộp đủ server. Giữ primary là KKPhim khi đã có.
  if (primary) {
    const title = primary.title || primary.name;
    const year = primary.release_year ?? primary.year;
    if (title) {
      const [foundOphim, foundPhimapi, foundNguonc] = await Promise.all([
        primary.source === 'ophim' ? Promise.resolve(null) : findSameMovieOnSource('ophim', title, year),
        secondary1 ? Promise.resolve(null) : findSameMovieOnSource('phimapi', title, year),
        secondary2 ? Promise.resolve(null) : findSameMovieOnSource('nguonc', title, year),
      ]);
      if (foundOphim) {
        if (primary.source === 'phimapi') {
          if (!secondary1) secondary1 = foundOphim;
          else if (!secondary2) secondary2 = foundOphim;
        } else if (primary.source === 'nguonc') {
          secondary2 = primary;
          primary = foundOphim;
        } else {
          primary = foundOphim;
        }
      }
      if (foundPhimapi && !secondary1) secondary1 = foundPhimapi;
      if (foundNguonc && !secondary2) secondary2 = foundNguonc;
    }
  }

  if (!primary) return null;

  // Phân theo nguồn: metadata ưu tiên KKPhim (phimapi); link phim ưu tiên KKPhim, không có mới lấy Ophim
  const ophimSrc = primary?.source === 'ophim' ? primary : (secondary1?.source === 'ophim' ? secondary1 : (secondary2?.source === 'ophim' ? secondary2 : null));
  const phimapiSrc = primary?.source === 'phimapi' ? primary : (secondary1?.source === 'phimapi' ? secondary1 : (secondary2?.source === 'phimapi' ? secondary2 : null));
  const nguoncSrc = primary?.source === 'nguonc' ? primary : (secondary1?.source === 'nguonc' ? secondary1 : (secondary2?.source === 'nguonc' ? secondary2 : null));

  // Metadata: ưu tiên KKPhim (phimapi); không có thì Ophim; không có nữa thì merge từ primary + secondaries
  const sameProdSecondaries = [secondary1, secondary2].filter((s) => s && isSameProduction(primary, s));
  const merged = phimapiSrc
    ? { ...phimapiSrc }
    : (ophimSrc ? { ...ophimSrc } : mergeMovieData(primary, ...sameProdSecondaries));
  merged.source = (phimapiSrc || ophimSrc || primary).source || null;

  // Link phim: chỉ lấy từ nguồn cùng production; ưu tiên KKPhim (PhimAPI) rồi Ophim
  const hasItemLink = (item) => { const e = (item?.link_embed || '').trim(); const m = (item?.link_m3u8 || '').trim(); return e.length > 0 || m.length > 0; };
  const hasSourceLinks = (s) => (s?.video_url && s.video_url.trim()) || (Array.isArray(s?.episodes) && s.episodes.some((ep) => (ep.server_data || []).some(hasItemLink)));
  if (phimapiSrc && isSameProduction(merged, phimapiSrc) && hasSourceLinks(phimapiSrc)) {
    merged.video_url = (phimapiSrc.video_url || '').trim() || merged.video_url;
  } else if (ophimSrc && isSameProduction(merged, ophimSrc) && (ophimSrc.video_url || merged.video_url)) {
    merged.video_url = (ophimSrc.video_url || merged.video_url || '').trim();
  }

  // Actor (cast): chỉ lấy từ nguồn cùng production; ưu tiên PhimAPI
  if (phimapiSrc && isSameProduction(merged, phimapiSrc) && Array.isArray(phimapiSrc.cast) && phimapiSrc.cast.length > 0) {
    merged.cast = phimapiSrc.cast;
  }

  // Server: chỉ gộp nguồn cùng một production (cùng type + year/tmdb); trùng slug khác phim thì bỏ qua
  const allEpisodes = [];
  const sources = [
    [phimapiSrc, 'PhimAPI'],
    [ophimSrc, 'Ophim'],
    [nguoncSrc, 'Nguonc'],
  ];

  function hasLink(item) {
    const embed = (item?.link_embed || '').trim();
    const m3u8 = (item?.link_m3u8 || '').trim();
    return embed.length > 0 || m3u8.length > 0;
  }

  function episodesWithLinks(eps) {
    if (!Array.isArray(eps)) return [];
    return eps.filter((ep) => {
      const data = ep.server_data || [];
      return data.some((d) => hasLink(d));
    });
  }

  for (const [src, label] of sources) {
    if (!src) continue;
    if (!isSameProduction(merged, src)) continue;
    const validEps = episodesWithLinks(src.episodes);
    if (validEps.length > 0) {
      for (const ep of validEps) {
        const baseName = ep.server_name || 'Nguồn';
        const serverName = baseName.startsWith('[') ? baseName : `[${label}] ${baseName}`;
        allEpisodes.push({ ...ep, server_name: serverName });
      }
    } else {
      // Phim lẻ hoặc nguồn không có episodes có link: dùng video_url để tạo 1 server, hiện đủ server mọi nguồn
      const url = (src.video_url || '').trim();
      if (url) {
        allEpisodes.push({
          server_name: `[${label}] Nguồn`,
          server_data: [{ name: 'Full', slug: 'full', link_embed: url, link_m3u8: url }],
        });
      }
    }
  }
  if (allEpisodes.length) merged.episodes = allEpisodes;

  // Thêm [SV #n] cho từng server (giống get.php)
  if (merged.episodes && merged.episodes.length) {
    let idx = 1;
    merged.episodes = merged.episodes.map((ep) => {
      const label = ep.server_name?.startsWith('[')
        ? ep.server_name
        : '[SV #' + (idx++) + '] ' + (ep.server_name || 'Nguồn');
      return { ...ep, server_name: label };
    });
  }
  return merged;
}

/**
 * Trang chủ: phim mới cập nhật. source = 'ophim' | 'phimapi' | 'nguonc' (mặc định phimapi/KKPhim).
 */
export async function getHome(source = 'phimapi', page = 1) {
  if (source === 'ophim') {
    const res = await fetchOphim(ophimUrls.home());
    if (!res?.data?.items) return { items: [], pagination: null };
    const cdn = res.data.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live';
    const items = (res.data.items || []).map((it) => ({
      _id: it._id,
      name: it.name,
      slug: it.slug,
      origin_name: it.origin_name,
      thumb_url: it.thumb_url ? (it.thumb_url.startsWith('http') ? it.thumb_url : ophimImageUrl(cdn, ophimImagePath(it.thumb_url))) : null,
      poster_url: it.poster_url ? (it.poster_url.startsWith('http') ? it.poster_url : ophimImageUrl(cdn, ophimImagePath(it.poster_url))) : null,
      year: it.year,
      type: it.type,
      episode_current: it.episode_current,
      quality: it.quality,
      lang: it.lang,
      lang_key: normalizeLangKey(it.lang_key, it.lang, it.lang),
      category: it.category || [],
      country: it.country || [],
    }));
    return {
      items,
      pagination: res.data.params?.pagination || null,
      type_list: res.data.type_list,
    };
  }
  if (source === 'phimapi') {
    const res = await fetchPhimApi(phimapiUrls.phimMoiCapNhat(page));
    if (!res?.items) return { items: res?.items || [], pagination: res?.pagination || null };
    const items = (res.items || []).map((it) => ({
      ...it,
      lang_key: normalizeLangKey(it.lang_key, it.lang, it.lang),
    }));
    return { items, pagination: res.pagination };
  }
  if (source === 'nguonc') {
    const res = await fetchNguonc(nguoncUrls.phimMoiCapNhat(page));
    if (!res?.items) return { items: [], pagination: null };
    const items = (res.items || []).map((it) => ({
      ...it,
      lang_key: normalizeLangKey(it.lang_key, it.lang, it.language),
    }));
    return {
      items,
      pagination: res.paginate ? { currentPage: res.paginate.current_page, totalPages: res.paginate.total_page, totalItems: res.paginate.total_items } : null,
    };
  }
  return { items: [], pagination: null };
}

/**
 * Tìm kiếm. source = 'ophim' | 'phimapi' | 'nguonc' (mặc định phimapi/KKPhim).
 */
export async function search(keyword, source = 'phimapi', page = 1) {
  if (!keyword || !String(keyword).trim()) return { items: [], pagination: null };
  const q = String(keyword).trim();
  if (source === 'ophim') {
    const res = await fetchOphim(ophimUrls.search(q));
    if (!res?.data) return { items: [], pagination: null };
    const cdn = res.data.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live';
    const items = (res.data.items || []).map((it) => ({
      _id: it._id,
      name: it.name,
      slug: it.slug,
      origin_name: it.origin_name,
      thumb_url: it.thumb_url ? (it.thumb_url.startsWith('http') ? it.thumb_url : ophimImageUrl(cdn, ophimImagePath(it.thumb_url))) : null,
      poster_url: it.poster_url ? (it.poster_url.startsWith('http') ? it.poster_url : ophimImageUrl(cdn, ophimImagePath(it.poster_url))) : null,
      year: it.year,
      type: it.type,
      episode_current: it.episode_current,
      quality: it.quality,
      lang: it.lang,
      lang_key: normalizeLangKey(it.lang_key, it.lang, it.lang),
    }));
    return { items, pagination: res.data.params?.pagination || null };
  }
  if (source === 'phimapi') {
    const res = await fetchPhimApi(phimapiUrls.timKiem(q, { page }));
    if (!res?.data?.items) return { items: [], pagination: res?.data?.params?.pagination || null };
    const items = (res.data.items || []).map((it) => ({
      ...it,
      lang_key: normalizeLangKey(it.lang_key, it.lang, it.lang),
    }));
    return { items, pagination: res.data.params?.pagination || null };
  }
  if (source === 'nguonc') {
    const res = await fetchNguonc(nguoncUrls.search(q));
    if (!res?.items) return { items: [], pagination: null };
    const items = (res.items || []).map((it) => ({
      ...it,
      lang_key: normalizeLangKey(it.lang_key, it.lang, it.language),
    }));
    return {
      items,
      pagination: res.paginate ? { currentPage: res.paginate.current_page, totalPages: res.paginate.total_page } : null,
    };
  }
  return { items: [], pagination: null };
}

/**
 * Danh sách thể loại (Ophim làm master).
 */
export async function getGenres() {
  const res = await fetchOphim(ophimUrls.theLoai());
  if (!res?.data?.items) return [];
  return res.data.items;
}

/**
 * Danh sách quốc gia (Ophim).
 */
export async function getCountries() {
  const res = await fetchOphim(ophimUrls.quocGia());
  if (!res?.data?.items) return [];
  return res.data.items;
}

/**
 * Danh sách năm phát hành (Ophim).
 */
export async function getYears() {
  const res = await fetchOphim(ophimUrls.namPhatHanh());
  if (!res?.data?.items) return [];
  return res.data.items;
}
