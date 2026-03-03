/**
 * Reset view_count_day / view_count_month khi sang ngày / tháng mới.
 * Dùng cho: Sôi nổi nhất (view trong tháng), Top 10 xem nhiều (view trong ngày).
 */
import db from '../config/db.js';

const KEY_DAY = 'view_count_day_reset';
const KEY_MONTH = 'view_count_month_reset';

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

const TZ = 'Asia/Ho_Chi_Minh';

/** Gọi trước khi query theo view_count_day hoặc view_count_month. Reset nếu đã sang ngày/tháng mới (theo GMT+7). */
export function ensureViewCountDayMonthReset() {
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD GMT+7
  const thisMonth = today.slice(0, 7); // YYYY-MM

  const lastDay = getSetting(KEY_DAY);
  if (lastDay !== today) {
    db.prepare('UPDATE movies SET view_count_day = 0').run();
    setSetting(KEY_DAY, today);
  }

  const lastMonth = getSetting(KEY_MONTH);
  if (lastMonth !== thisMonth) {
    db.prepare('UPDATE movies SET view_count_month = 0').run();
    setSetting(KEY_MONTH, thisMonth);
  }
}
