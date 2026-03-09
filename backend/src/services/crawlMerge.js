/**
 * Crawl phim: ưu tiên KKPhim (PhimAPI) trước, bổ sung Ophim. Link m3u8 luôn ưu tiên KKPhim.
 */

import { phimapi as phimapiUrls, ophim as ophimUrls } from '../config/crawlSources.js';
import { fetchPhimApi, fetchOphim } from './crawlFetch.js';
import { normalizePhimApi, normalizeOphim, normalizeLangKey, mergeMovieData, mergeEpisodesPreferPrimaryLinks } from './normalizeMovie.js';

/**
 * Lấy chi tiết phim theo slug: KKPhim trước, rồi Ophim; merge với ưu tiên KKPhim và link m3u8 từ KKPhim.
 */
export async function getMovieBySlug(slug) {
  let primary = null;
  let secondary = null;
  try {
    const resPhim = await fetchPhimApi(phimapiUrls.phim(slug));
    if (resPhim && resPhim.status !== false && resPhim.movie && typeof resPhim.movie === 'object') {
      primary = normalizePhimApi(resPhim);
    }
  } catch (e) {
    console.error('[crawlMerge] fetchPhimApi error for slug:', slug, e?.message);
  }
  try {
    const resOphim = await fetchOphim(ophimUrls.phim(slug));
    if (resOphim?.data?.item) {
      secondary = normalizeOphim(resOphim);
    }
  } catch (e) {
    console.error('[crawlMerge] fetchOphim error for slug:', slug, e?.message);
  }
  if (primary && secondary) {
    const merged = mergeMovieData(primary, secondary);
    merged.episodes = mergeEpisodesPreferPrimaryLinks(primary.episodes || [], secondary.episodes || []);
    merged.source = 'phimapi';
    merged.video_url = primary.video_url || secondary.video_url || merged.video_url;
    return merged;
  }
  if (primary) return primary;
  if (secondary) return secondary;
  return null;
}

/**
 * Trang chủ: phim mới cập nhật — hỗ trợ KKPhim (phimapi) và Ophim; thứ tự ưu tiên phimapi trước.
 */
export async function getHome(source = 'phimapi', page = 1) {
  if (source === 'phimapi') {
    const res = await fetchPhimApi(phimapiUrls.phimMoiCapNhat(page));
    const rawItems = Array.isArray(res?.items) ? res.items : [];
    const items = rawItems.map((it) => {
      try {
        return { ...it, lang_key: normalizeLangKey(it?.lang_key, it?.lang, it?.lang) };
      } catch {
        return it;
      }
    });
    return { items, pagination: res?.pagination || null };
  }
  if (source === 'ophim') {
    const res = await fetchOphim(ophimUrls.home(page));
    const data = res?.data;
    const rawItems = Array.isArray(data?.items) ? data.items : [];
    const pagination = data?.params?.pagination;
    const items = rawItems.map((it) => ({
      slug: it?.slug,
      name: it?.name,
      origin_name: it?.origin_name,
      category: it?.category || [],
      country: it?.country || [],
      type: it?.type,
      lang: it?.lang,
      lang_key: it?.lang_key,
      year: it?.year,
      episode_current: it?.episode_current,
      thumb_url: it?.thumb_url,
      ...it,
    }));
    return {
      items,
      pagination: pagination ? { totalPages: Math.ceil((pagination.totalItems || 0) / (pagination.totalItemsPerPage || 24)), currentPage: pagination.currentPage || page } : null,
    };
  }
  return { items: [], pagination: null };
}

/**
 * Tìm kiếm — chỉ nguồn KKPhim (phimapi).
 */
export async function search(keyword, source = 'phimapi', page = 1) {
  if (!keyword || !String(keyword).trim()) return { items: [], pagination: null };
  if (source !== 'phimapi') return { items: [], pagination: null };
  const q = String(keyword).trim();
  const res = await fetchPhimApi(phimapiUrls.timKiem(q, { page }));
  if (!res?.data?.items) return { items: [], pagination: res?.data?.params?.pagination || null };
  const items = (res.data.items || []).map((it) => ({
    ...it,
    lang_key: normalizeLangKey(it.lang_key, it.lang, it.lang),
  }));
  return { items, pagination: res.data.params?.pagination || null };
}

/**
 * Danh sách thể loại (KKPhim/PhimAPI).
 */
export async function getGenres() {
  const res = await fetchPhimApi(phimapiUrls.theLoai());
  if (!res) return [];
  if (Array.isArray(res)) return res;
  const items = res.data?.items ?? res.items ?? res?.data ?? [];
  return Array.isArray(items) ? items : [];
}

/**
 * Danh sách quốc gia (KKPhim/PhimAPI).
 */
export async function getCountries() {
  const res = await fetchPhimApi(phimapiUrls.quocGia());
  if (!res) return [];
  if (Array.isArray(res)) return res;
  const items = res.data?.items ?? res.items ?? res?.data ?? [];
  return Array.isArray(items) ? items : [];
}

/**
 * Danh sách năm phát hành (sinh từ năm hiện tại về 1980, vì PhimAPI không có endpoint danh sách năm).
 */
export async function getYears() {
  const currentYear = new Date().getFullYear();
  const items = [];
  for (let y = currentYear; y >= 1980; y--) {
    items.push({ name: String(y), slug: String(y) });
  }
  return items;
}
