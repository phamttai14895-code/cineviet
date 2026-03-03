# Phim - Web xem phim

Dự án full-stack: Backend Node.js + Express + SQLite, Frontend React. Đăng nhập Email/Password + Google/Facebook OAuth, JWT. Có AI gợi ý phim và Admin dashboard.

## Yêu cầu

- Node.js 18+
- npm hoặc yarn

## Cài đặt

### 1. Cài dependency

```bash
cd D:\phim
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Cấu hình Backend

```bash
cd backend
copy .env.example .env
```

Chỉnh file `.env`:

- `JWT_SECRET`: chuỗi bí mật cho JWT (bắt buộc).
- `FRONTEND_URL`: URL frontend (mặc định `http://localhost:5173`).
- **Google OAuth**: tạo project tại [Google Cloud Console](https://console.cloud.google.com/), bật Google+ API, tạo OAuth 2.0 Client (Web), thêm Redirect URI: `http://localhost:5000/api/auth/google/callback`. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.
- **Facebook OAuth**: tạo app tại [Facebook Developers](https://developers.facebook.com/), thêm Facebook Login, Redirect URI: `http://localhost:5000/api/auth/facebook/callback`. Điền `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL`.

### 3. Khởi tạo database

```bash
cd backend
npm run db:init
```

Tạo file SQLite tại `backend/data/phim.db`, bảng users, movies, genres, v.v. và seed admin (email: `admin@phim.local`, mật khẩu: `admin123`).

### 4. Chạy dự án

**Chạy đồng thời backend + frontend (từ thư mục gốc):**

```bash
cd D:\phim
npm run dev
```

- Backend: http://localhost:5000  
- Frontend: http://localhost:5173  

Hoặc chạy riêng:

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## Tính năng

- **Xem phim**: Trang chủ, Khám phá (lọc thể loại, tìm kiếm), Chi tiết phim, Trang xem phim (video).
- **Tài khoản**: Đăng ký / Đăng nhập (Email + mật khẩu), Google OAuth, Facebook OAuth, JWT. Trang “Của tôi”: Yêu thích, Lịch sử xem.
- **Cá nhân hóa (AI)**: Gợi ý “Dành cho bạn” dựa trên lịch sử xem và thể loại yêu thích.
- **Admin**: Thống kê (số user, phim, lượt xem), Quản lý phim (thêm/sửa/xóa), Quản lý người dùng (xem danh sách).

## Tài khoản mặc định

- Admin: `admin@phim.local` / `admin123` (sau khi chạy `npm run db:init`).

## Cấu trúc thư mục

```
phim/
├── backend/
│   ├── data/          # SQLite DB (tạo bởi db:init)
│   ├── src/
│   │   ├── config/    # db, passport
│   │   ├── middleware/# auth JWT
│   │   ├── routes/    # auth, movies, user, recommendations, admin
│   │   └── index.js
│   └── scripts/
│       └── initDb.js
├── frontend/
│   ├── src/
│   │   ├── api/       # client API
│   │   ├── components/
│   │   ├── context/   # AuthContext
│   │   ├── pages/    # Home, Login, Browse, Movie, Watch, Profile, Admin
│   │   └── main.jsx
│   └── index.html
└── package.json       # script "dev" chạy cả backend + frontend
```
