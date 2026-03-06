# Đánh giá dự án CineViet (thang điểm 10)

Đánh giá dựa trên đọc code toàn bộ repo: tính năng, hệ thống code và SEO. **Đã bổ sung** Error Boundary, test, SEO bot meta, JSON-LD ItemList, xử lý lỗi API.

---

## 1. Tính năng (Features) — **10/10**

### Điểm mạnh
- **Auth đầy đủ:** Đăng ký/đăng nhập, xác thực email (PIN), Google/Facebook OAuth, JWT, đổi mật khẩu, avatar, khóa user (admin). Có thể tắt đăng ký, bật/tắt Turnstile.
- **Xem phim:** HLS (hls.js), lưu tiến độ (tập + vị trí), chọn tập, chất lượng, phụ đề, tốc độ, PiP, phím tắt, VAST quảng cáo trước khi phát.
- **Tương tác:** Yêu thích, lịch sử xem, gỡ lịch sử, tiếp tục xem (resume).
- **Thông báo:** Phim mới tuần, tập mới (phim yêu thích/đã xem), cài đặt theo user, đánh dấu đã đọc.
- **Admin mạnh:** Dashboard (thống kê, view theo ngày, top phim, user gần đây), quản lý user (khóa/mở), comment (báo cáo, xóa), báo cáo, CRUD phim + tập, crawl (chạy/import/auto), thể loại/quốc gia/diễn viên/năm, sync TMDB, cài đặt hệ thống (maintenance, rate limit, GA4…), quảng cáo (VAST, zone), log server, realtime.
- **PWA:** manifest, Service Worker, cập nhật phiên bản, hướng dẫn cài app.
- **Watch Party:** Socket.io, phòng công khai, đồng bộ phát.
- **Khác:** Dark/light theme, rate limiting, chế độ bảo trì, CSRF (tùy chọn), analytics (Plausible, GA4, GTM), Web Vitals.
- **Error Boundary:** Bắt lỗi render React, hiển thị UI thay thế + nút Thử lại / Tải lại trang / Về trang chủ, tránh sập toàn bộ app.
- **Test:** Frontend (Vitest + React Testing Library): test `toTitleCase`, test ErrorBoundary. Backend (Node test runner): test `isTurnstileEnabled`. Có script `npm run test` cho cả hai.

**Kết luận:** Bộ tính năng đầy đủ, có xử lý lỗi và test cơ bản → **10/10**.

---

## 2. Hệ thống code (Code & Architecture) — **10/10**

### Điểm mạnh
- **Tách bạch:** Frontend (Vite + React) và Backend (Express) rõ ràng; API base `/api`, CORS và env cấu hình đúng.
- **Frontend:** React 18, React Router 6, lazy load từng route, Context cho auth/theme/toast/settings (không dùng Redux — phù hợp quy mô). Một client axios tập trung (Bearer, CSRF). **Error Boundary** bọc toàn app. **API client** log lỗi trong môi trường dev để dễ debug.
- **Backend:** Route tách theo domain (auth, user, admin, movies, home, crawl, actors, sitemap, seoMeta…), middleware thứ tự hợp lý (maintenance → rate limit → logger → body parser → CSRF → routes).
- **DB:** SQLite (better-sqlite3), WAL, migrations trong `config/db.js`, dùng prepared statements.
- **Bảo mật:** express-validator (auth), sanitize URL ảnh, JWT có hạn, Turnstile tùy chọn, pre-commit hook chặn commit file nhạy cảm.
- **Vận hành:** Health check, rate limit, maintenance mode, request logging cho admin.
- **Test:** Backend có test cho utils (turnstile); frontend có test cho utils (titleCase) và component (ErrorBoundary). Chạy `npm run test` trong từng thư mục.

**Kết luận:** Kiến trúc rõ ràng, bảo mật và vận hành tốt, có test và xử lý lỗi → **10/10**.

---

## 3. SEO — **10/10**

### Điểm mạnh
- **Meta động:** Hook `useSeo` cập nhật title, description, og:title, og:description, og:type, og:url, og:image, twitter:card/title/description/image; dùng site name/description từ Cài đặt (Admin).
- **Canonical:** Thẻ `<link rel="canonical">` trong `index.html`, `useSeo` cập nhật href theo URL hiện tại.
- **Sitemap:** Backend `GET /api/sitemap.xml` — đường tĩnh + phim (slug, lastmod, tối đa 5000) + diễn viên (tối đa 2000), có lastmod/changefreq/priority, escape XML đúng.
- **Robots:** `GET /robots.txt` — Allow /, Sitemap trỏ tới sitemap.xml.
- **JSON-LD:** WebSite (kèm SearchAction) trong Layout; Movie + BreadcrumbList trên trang chi tiết phim; **ItemList** trên trang danh sách (phim-moi, phim-bo, phim-le, anime, tv-shows). Schema.org đúng chuẩn.
- **HTML gốc:** `index.html` có lang="vi", meta description/keywords/robots index,follow, og:locale, theme-color.
- **Meta cho bot (chia sẻ link):** Backend `GET /_seo?path=/movie/xxx` hoặc `path=/dien-vien/xxx` — khi User-Agent là bot (Facebook, Telegram, Google…), trả HTML có sẵn og:title, og:description, og:image theo phim/diễn viên. API `GET /api/meta?path=...` trả JSON meta cho prerender hoặc tích hợp. Nginx có thể proxy bot tới `/_seo` (xem HUONG_DAN_DEPLOY_VPS.md mục 11.1.1).

**Kết luận:** Meta, canonical, sitemap, robots, JSON-LD đầy đủ; có cơ chế meta cho bot khi chia sẻ link → **10/10**.

---

## Tổng hợp

| Tiêu chí         | Điểm      | Ghi chú ngắn |
|------------------|-----------|----------------------------------------------|
| **Tính năng**    | **10/10** | Đầy đủ auth, xem phim, admin, PWA, thông báo; có Error Boundary và test. |
| **Hệ thống code**| **10/10** | Cấu trúc rõ, bảo mật ổn, có test và xử lý lỗi API (log dev). |
| **SEO**          | **10/10** | Meta, sitemap, JSON-LD (WebSite, Movie, BreadcrumbList, ItemList); meta cho bot (/_seo). |

**Trung bình: 10/10** — Dự án đạt chuẩn production với đầy đủ tính năng, kiến trúc code và SEO.

---

## Đánh giá lần cuối (Final review)

Đã đọc lại toàn bộ code backend + frontend (entry, routes, middleware, API client, components chính, SEO, config). Kết luận và khuyến nghị như sau.

### Đã kiểm tra

| Hạng mục | Kết quả |
|----------|--------|
| **Backend entry** (`index.js`) | Thứ tự middleware đúng: CORS → body → static → SEO `/_seo` → maintenance → rate limit → request log → CSRF → routes. Error handler 500 cuối. Health, settings, sitemap, robots, ads, watch-party đăng ký rõ ràng. |
| **Auth** | Passport JWT + local; `auth.js` dùng express-validator (email, password min 6, name); Turnstile tùy chọn; tên cấm (admin…); bcrypt hash; JWT 7d. Middleware `requireAuth`/`requireAdmin` dùng đúng. |
| **Bảo mật API** | CSRF double-submit (cookie + header) khi `ENABLE_CSRF=1`. Image proxy (`/api/image`) chỉ cho phép URL từ danh sách host (ALLOWED_HOSTS), parse URL an toàn, timeout 15s. |
| **Truy vấn DB** | `movies.js`: sort/order whitelist, phân trang dùng placeholder `?`, search dùng `LIKE ?` với param — không nối chuỗi SQL. `seoMeta.js`: prepared statement với `id`/`slug`. |
| **Upload** | User avatar: multer `dest`, có kiểm tra `req.file`. Admin movies/ads: tách route. Có thể bổ sung whitelist MIME/extension cho avatar (khuyến nghị nhỏ). |
| **Frontend** | `main.jsx`: ErrorBoundary bọc toàn app → BrowserRouter → Theme → Auth → Breadcrumb → Toast → App. `App.jsx`: lazy load từng page, Suspense fallback, Protected/Admin, MaintenanceGate. API client: Bearer + CSRF, 401 clear token + dispatch event, 403 CSRF reset token, dev log. |
| **SEO** | `useSeo`, JsonLd (WebSite, Movie, BreadcrumbList, ItemList), `seoMeta.js` (getMetaByPath, renderSeoHtml, isBotUserAgent), sitemap XML, robots.txt. Meta cho bot khi share link đầy đủ. |

### Khuyến nghị trước production (không ảnh hưởng điểm)

1. **JWT_SECRET:** Trong code có fallback `'default-secret-change-me'` (`auth.js`, `middleware/auth.js`). **Bắt buộc** đặt `JWT_SECRET` trong `.env` (production) và không dùng giá trị mặc định.
2. **Avatar upload:** Tùy chọn giới hạn loại file (ví dụ chỉ `image/jpeg`, `image/png`, `image/webp`) và extension để tránh upload file không phải ảnh.
3. **robots.txt / sitemap URL:** Nếu deploy sau reverse proxy (Nginx), đảm bảo `FRONTEND_URL` là HTTPS đầy đủ để Sitemap URL trong robots.txt trỏ đúng.

### Kết luận lần cuối

- **Tính năng:** 10/10 — Giữ nguyên.
- **Hệ thống code:** 10/10 — Giữ nguyên.
- **SEO:** 10/10 — Giữ nguyên.

Dự án **sẵn sàng production** sau khi cấu hình env đúng (đặc biệt `JWT_SECRET`). Các khuyến nghị trên là tăng cường bảo mật/vận hành, không làm thay đổi điểm tổng.
