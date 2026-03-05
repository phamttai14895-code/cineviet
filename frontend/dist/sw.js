/* Service worker: cache tĩnh, offline fallback trang riêng, thông báo cập nhật PWA */
const CACHE_NAME = 'cineviet-v2';

self.addEventListener('install', (e) => {
  /* Không gọi skipWaiting() ở đây để trang có thể hiện "Đã có phiên bản mới" và cho user bấm tải lại */
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/index.html', '/offline.html']);
    }).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

/* Nhận lệnh từ trang: kích hoạt SW mới (skipWaiting) để áp dụng bản cập nhật */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || u.pathname.startsWith('/api') || u.pathname.startsWith('/socket')) {
    return;
  }
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        if (res.status === 200 && (u.pathname === '/' || u.pathname === '/index.html' || u.pathname.startsWith('/assets') || /\.(js|css|ico|png|svg|woff2?)$/i.test(u.pathname))) {
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        return caches.match(e.request).then((r) => {
          if (r) return r;
          /* Yêu cầu điều hướng (trang) khi offline → trả về trang offline chuyên dụng */
          if (e.request.mode === 'navigate') return caches.match('/offline.html').then((off) => off || caches.match('/index.html'));
          return caches.match('/index.html');
        });
      })
  );
});
