/**
 * In-memory request log buffer cho Server Logs (admin).
 * Format mỗi entry: [HH:mm:ss] [LEVEL] METHOD path STATUS XXms
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

function levelForStatus(status) {
  if (status >= 500) return 'ERROR';
  if (status >= 400) return 'WARN';
  return 'INFO';
}

export function logRequest(method, path, status, ms) {
  const time = nowTime();
  const level = levelForStatus(status);
  entries.push({ time, level, method, path, status, ms });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function getEntries(limit = 200) {
  return entries.slice(-limit);
}

export default { logRequest, getEntries };
