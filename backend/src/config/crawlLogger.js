/**
 * In-memory crawl log buffer cho Crawl Logs (admin).
 * Format mỗi entry: { time, level, message, slug?, detail? }
 */
const MAX_ENTRIES = 500;
const entries = [];

/** Giờ GMT+7 (Việt Nam) cho log — HH:mm:ss */
function nowTime() {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
