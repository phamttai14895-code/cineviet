/**
 * Múi giờ GMT+7 (Asia/Ho_Chi_Minh) cho hiển thị và parse ngày giờ.
 */

const TZ = 'Asia/Ho_Chi_Minh';

/** Parse chuỗi ngày từ API (coi là GMT+7 nếu không có timezone). */
export function parseGMT7(dateStr) {
  if (dateStr == null) return null;
  if (typeof dateStr !== 'string') return new Date(dateStr);
  const s = dateStr.replace(' ', 'T').trim();
  if (/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(s) && !s.endsWith('Z') && !/[-+]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s + '+07:00');
  }
  return new Date(s);
}

/** Định dạng tương đối: "Vừa xong", "5 phút trước", ... (so với "bây giờ" GMT+7). */
export function formatRelativeTimeGMT7(dateStr) {
  const d = parseGMT7(dateStr);
  if (!d || Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return d.toLocaleDateString('vi-VN', { timeZone: TZ });
}

/** Ngày giờ đầy đủ GMT+7. */
export function formatDateTimeGMT7(dateStr) {
  const d = parseGMT7(dateStr);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
}

/** Chỉ ngày GMT+7. */
export function formatDateGMT7(dateStr) {
  const d = parseGMT7(dateStr);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { timeZone: TZ });
}
