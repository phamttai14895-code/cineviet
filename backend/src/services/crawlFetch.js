/**
 * Gọi API 3 nguồn phim (Ophim, KKPhim, Nguonc) với timeout và xử lý lỗi.
 * Ném lỗi có message rõ ràng để route trả 500 với nội dung hữu ích.
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
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const status = res.status;
      if (status === 524 || status === 520 || status === 522 || status === 523) {
        throw new Error(`Nguồn phim phản hồi quá chậm hoặc tạm lỗi (${status}). Thử lại sau vài phút.`);
      }
      throw new Error(`Nguồn phim trả lỗi ${status}: ${text.slice(0, 100) || res.statusText}`);
    }
    const text = await res.text();
    if (!text) throw new Error('Nguồn phim trả nội dung rỗng');
    return JSON.parse(text);
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error('Kết nối nguồn phim quá thời gian (timeout). Thử lại sau.');
    if (err instanceof SyntaxError) throw new Error('Nguồn phim trả dữ liệu không hợp lệ (JSON lỗi).');
    if (err.message && err.message.includes('Nguồn phim')) throw err;
    throw new Error(err.message || 'Không kết nối được nguồn phim. Kiểm tra mạng hoặc thử lại sau.');
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
