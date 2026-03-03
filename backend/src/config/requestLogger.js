/**
 * In-memory request log buffer cho Server Logs (admin).
 * Format mỗi entry: [HH:mm:ss] [LEVEL] METHOD path STATUS XXms
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
