/**
 * Chỉ dùng nguồn KKPhim (PhimAPI): lấy chi tiết phim, trang chủ, tìm kiếm, thể loại, quốc gia, năm.
 */

import { phimapi as phimapiUrls } from '../config/crawlSources.js';
import { fetchPhimApi } from './crawlFetch.js';
import { normalizePhimApi, normalizeLangKey } from './normalizeMovie.js';

/**
 * Lấy chi tiết phim theo slug — chỉ từ KKPhim (PhimAPI).
 */
export async function getMovieBySlug(slug) {
  const res = await fetchPhimApi(phimapiUrls.phim(slug));
  if (!res?.movie || res.status === false) return null;
  return normalizePhimApi(res);
}

/**
 * Trang chủ: phim mới cập nhật — chỉ nguồn KKPhim (phimapi).
 */
export async function getHome(source = 'phimapi', page = 1) {
  if (source !== 'phimapi') return { items: [], pagination: null };
  const res = await fetchPhimApi(phimapiUrls.phimMoiCapNhat(page));
  if (!res?.items) return { items: [], pagination: res?.pagination || null };
  const items = (res.items || []).map((it) => ({
    ...it,
    lang_key: normalizeLangKey(it.lang_key, it.lang, it.lang),
  }));
  return { items, pagination: res.pagination };
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
