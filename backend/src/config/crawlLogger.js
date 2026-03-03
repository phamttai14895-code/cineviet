/**
 * In-memory crawl log buffer cho Crawl Logs (admin).
 * Format mỗi entry: { time, level, message, slug?, detail? }
 */
const MAX_ENTRIES = 500;
const entries = [];

function nowTime() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function log(level, message, extra = {}) {
  const time = nowTime();
  entries.push({ time, level, message, ...extra });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function logInfo(message, extra) {
  log('INFO', message, extra);
}

export function logWarn(message, extra) {
  log('WARN', message, extra);
}

export function logError(message, extra) {
  log('ERROR', message, extra);
}

export function getEntries(limit = 200) {
  return entries.slice(-limit);
}

export default { log, logInfo, logWarn, logError, getEntries };
