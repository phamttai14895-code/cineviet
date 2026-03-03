# Hướng dẫn PWA (Progressive Web App) — CineViet

Dự án đã cấu hình PWA cơ bản: manifest, service worker, đăng ký khi production. Tài liệu này mô tả cách hoạt động và cách kiểm tra / tùy chỉnh.

---

## 1. Các thành phần đã có

### 1.1 manifest.json

- **Vị trí:** `frontend/public/manifest.json`
- **Nội dung chính:**
  - `name`, `short_name`: "CineViet - Xem phim trực tuyến" / "CineViet"
  - `description`: Mô tả web
  - `start_url`: "/" (trang mở khi mở app từ màn hình chính)
  - `display`: "standalone" (giao diện giống app, không thanh URL)
  - `background_color`: "#0A111F" (nền khi khởi động)
  - `theme_color`: "#2DE0A0" (màu thanh trạng thái trên mobile; có thể đổi theo theme trong runtime qua `<meta name="theme-color">`)
  - `orientation`: "any"
  - `lang`: "vi"
  - `icons`: 192x192 và 512x512 (purpose "any" và "maskable")

**Lưu ý:** `theme_color` và `background_color` trong manifest là giá trị mặc định (theme tối). Ở runtime, theme sáng/tối được cập nhật qua thẻ `<meta name="theme-color">` trong `ThemeContext.jsx` (light: #078f66, dark: #2DE0A0).

### 1.2 Service worker (sw.js)

- **Vị trí:** `frontend/public/sw.js`
- **Chức năng:**
  - **Install:** Cache `/` và `/index.html` khi cài đặt.
  - **Activate:** Xóa cache cũ (tên cache: `cineviet-v1`; khi đổi version cần đổi tên trong code để user nhận bản mới).
  - **Fetch:**
    - Chỉ xử lý request cùng origin, GET; bỏ qua `/api`, `/socket`.
    - Ưu tiên network; nếu thành công và là trang chủ hoặc asset (js, css, ico, png, svg, font), clone response vào cache.
    - Nếu network lỗi thì trả về cache (hoặc fallback `/index.html` cho SPA).

**Khi cập nhật nội dung:** Đổi `CACHE_NAME` trong `sw.js` (ví dụ `cineviet-v2`) rồi build lại; lần sau user mở app, SW mới sẽ activate và xóa cache cũ.

### 1.3 Đăng ký service worker (frontend)

- **Vị trí:** `frontend/src/main.jsx`
- Chỉ đăng ký khi **production** (`import.meta.env.PROD`):
  - Sau khi load trang, gọi `navigator.serviceWorker.register('/sw.js')`.
  - Có `.catch()` để tránh lỗi khi chạy local (ví dụ dev không dùng SW).

### 1.4 index.html

- Có thẻ `<link rel="manifest" href="/manifest.json">`.
- Có `<meta name="theme-color" content="...">` (mặc định; giá trị thực cập nhật bằng JS trong ThemeContext).

---

## 2. "Thêm vào màn hình" (Add to Home Screen)

- **Trên Android (Chrome/Edge):** Menu → "Thêm vào màn hình" / "Cài đặt ứng dụng". Trình duyệt dùng `manifest.json` (tên, icon, theme_color, start_url) để tạo shortcut.
- **Trên iOS (Safari):** Share → "Thêm vào Màn hình chính". iOS không dùng manifest đầy đủ nhưng vẫn có thể thêm; icon và tên có thể lấy từ meta/apple-mobile-web-app-capable nếu bạn thêm.
- **Trên desktop (Chrome/Edge):** Icon "Cài đặt" trên thanh địa chỉ hoặc menu → "Cài đặt CineViet...".

Sau khi thêm, mở app từ icon sẽ chạy ở chế độ standalone (không hiện thanh URL), dùng `start_url` và cache từ SW.

---

## 3. Hướng dẫn kiểm tra PWA

1. **Build production:**  
   `cd frontend && npm run build`
2. **Xem bản build (preview):**  
   `npm run preview` (Vite) hoặc serve thư mục `frontend/dist` qua HTTP (ví dụ Nginx).
3. **Chrome DevTools:**
   - Application → Manifest: kiểm tra manifest load đúng, không lỗi; xem icons, theme_color, start_url.
   - Application → Service Workers: kiểm tra SW đăng ký, status "activated"; có thể "Update" hoặc "Unregister" để test.
   - Application → Cache Storage: xem cache `cineviet-v1` (hoặc tên hiện tại) và các request đã cache.
4. **Lighthouse (Chrome):** Chạy audit "Progressive Web App" trên trang production; sửa các mục còn thiếu (icon, theme_color, HTTPS, v.v.).

---

## 4. Tùy chọn nâng cao

- **Offline fallback:** Hiện tại khi fetch lỗi sẽ trả về cache hoặc `/index.html`. Có thể thêm trang "Bạn đang offline" (offline.html) và trong SW `caches.match('/offline.html')` nếu không có cache cho request.
- **Cập nhật SW:** Khi có bản build mới, có thể báo user "Đã có phiên bản mới, tải lại?" bằng cách lắng nghe `registration.waiting` và gọi `registration.update()` hoặc `skipWaiting()` rồi reload.
- **Icon:** Đảm bảo `frontend/public/icon-192.png` và `icon-512.png` tồn tại; format PNG, kích thước đúng. Maskable icon nên có safe zone (padding) theo khuyến nghị của Google.

---

## 5. Tóm tắt

| Thành phần        | File / vị trí              | Ghi chú                                      |
|-------------------|----------------------------|----------------------------------------------|
| Manifest          | `frontend/public/manifest.json` | Tên, icon, theme_color, start_url, display   |
| Service worker    | `frontend/public/sw.js`    | Cache trang chủ + asset; fallback offline     |
| Đăng ký SW        | `frontend/src/main.jsx`    | Chỉ khi production                           |
| Theme-color động  | `frontend/src/context/ThemeContext.jsx` | Cập nhật meta theme-color theo sáng/tối     |
| Link manifest     | `frontend/index.html`      | `<link rel="manifest" href="/manifest.json">`|

Sau khi deploy lên HTTPS, người dùng có thể "Thêm vào màn hình" và mở app như ứng dụng.

**Deploy:** Xem **[HUONG_DAN_DEPLOY_VPS.md](./HUONG_DAN_DEPLOY_VPS.md)** để triển khai backend + frontend lên VPS (Nginx, PM2, SSL).
