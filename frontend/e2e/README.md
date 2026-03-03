# E2E Tests (Playwright)

Kiểm thử tự động cho luồng chính: **xem phim**, **tìm kiếm**, **đăng nhập**, **đa ngôn ngữ (i18n)**.

## Chạy test

```bash
# Từ thư mục frontend
npm run test:e2e
```

- Nếu chưa chạy dev server, Playwright sẽ tự khởi động `npm run dev` và chờ `http://localhost:5173`.
- Dùng biến môi trường `PLAYWRIGHT_BASE_URL` nếu chạy trên URL khác (vd. staging).

## Cấu trúc

| File | Nội dung |
|------|----------|
| `smoke.spec.js` | Smoke: trang chủ → tìm kiếm, chi tiết phim, xem phim, modal đăng nhập |
| `flows.spec.js` | Luồng đầy đủ: xem phim, tìm kiếm, đăng nhập, i18n + tìm kiếm |
| `auth.spec.js` | Modal đăng nhập: mở, form email/password, nút Google |
| `login.spec.js` | Đăng nhập: mở/đóng modal |
| `search.spec.js` | Trang tìm kiếm, tìm từ header |
| `watch.spec.js` | Trang chi tiết phim, nút xem, trang watch (player) |
| `i18n.spec.js` | Chuyển ngôn ngữ VI/EN, kiểm tra nội dung |

## CI

Trong CI, set `CI=1` để Playwright dùng `PLAYWRIGHT_BASE_URL` (không tự chạy webServer) và retry 2 lần.
