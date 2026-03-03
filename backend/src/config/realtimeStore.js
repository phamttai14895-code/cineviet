/**
 * In-memory store: người dùng đang xem (heartbeat từ POST /movies/:id/watch).
 * Coi là "đang xem" nếu lastSeen trong vòng STALE_MS.
 */
const STALE_MS = 65 * 1000; // 65 giây (frontend ping mỗi 15s)
const store = new Map(); // key = `${userId}:${movieId}`

function key(userId, movieId) {
  return `${userId}:${movieId}`;
}

export function heartbeat(userId, userName, movieId, movieTitle) {
  const k = key(userId, movieId);
  store.set(k, {
    userId,
    userName: userName || 'User',
    movieId,
    movieTitle: movieTitle || 'Phim',
    lastSeen: Date.now(),
  });
}

export function getViewers() {
  const now = Date.now();
  const list = [];
  for (const [, v] of store) {
    if (now - v.lastSeen <= STALE_MS) list.push({ ...v });
    else store.delete(key(v.userId, v.movieId));
  }
  list.sort((a, b) => b.lastSeen - a.lastSeen);
  return list;
}

export function getStats() {
  const viewers = getViewers();
  const byMovie = {};
  viewers.forEach((v) => {
    byMovie[v.movieId] = (byMovie[v.movieId] || 0) + 1;
  });
  return {
    totalViewers: viewers.length,
    byMovie,
  };
}

export default { heartbeat, getViewers, getStats };
