/**
 * Gọi API 3 nguồn phim (Ophim, KKPhim, Nguonc) với timeout và xử lý lỗi.
 */

const TIMEOUT_MS = 25000;
const USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

async function fetchJson(url) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    clearTimeout(id);
    return null;
  }
}

/** Ophim v1: GET home, search, phim/[slug], the-loai, quoc-gia, nam-phat-hanh */
export async function fetchOphim(url) {
  return fetchJson(url);
}

/** KKPhim/PhimAPI */
export async function fetchPhimApi(url) {
  return fetchJson(url);
}

/** Nguonc */
export async function fetchNguonc(url) {
  return fetchJson(url);
}

/** Gọi chung (dùng cho bất kỳ nguồn nào) */
export async function fetchSource(url) {
  return fetchJson(url);
}
