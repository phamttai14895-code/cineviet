# Hướng dẫn Deploy dự án CineViet lên VPS Ubuntu

Tài liệu chi tiết triển khai **backend** (Node.js/Express) và **frontend** (Vite/React) lên **VPS Ubuntu**, dùng **Nginx** reverse proxy, **PM2** quản lý process, **SSL** Let's Encrypt. Kèm hướng dẫn **xóa toàn bộ user và tạo lại tài khoản admin**.

---

## Mục lục

1. [Yêu cầu](#1-yêu-cầu)
2. [Cài đặt môi trường trên VPS](#2-cài-đặt-môi-trường-trên-vps)
3. [Đưa code lên VPS](#3-đưa-code-lên-vps)
4. [Cấu hình Backend](#4-cấu-hình-backend) — *trong đó [4.3 Cấu hình từng tính năng](#43-cấu-hình-từng-tính-năng-turnstile-email-google-facebook--) mô tả chi tiết Turnstile, Email, Google, Facebook, GA4, API*
5. [Chạy Backend bằng PM2](#5-chạy-backend-bằng-pm2)
6. [Build Frontend](#6-build-frontend)
7. [Cấu hình Nginx](#7-cấu-hình-nginx)
8. [SSL (HTTPS) – Let's Encrypt hoặc Cloudflare](#8-ssl-https--lets-encrypt-hoặc-cloudflare)
9. [Firewall](#9-firewall)
10. [Xóa toàn bộ user và tạo lại tài khoản admin](#10-xóa-toàn-bộ-user-và-tạo-lại-tài-khoản-admin)
11. [Kiểm tra sau deploy](#11-kiểm-tra-sau-deploy)
12. [Cập nhật bản mới](#12-cập-nhật-bản-mới)
13. [Tóm tắt & Checklist](#13-tóm-tắt--checklist)

---

## 1. Yêu cầu

- **VPS:** Ubuntu 22.04 LTS (hoặc 20.04), tối thiểu 1 CPU, 1 GB RAM, ổ cứng đủ cho DB + uploads.
- **Domain:** Trỏ A record về IP VPS (vd. `cineviet.vn` → `123.45.67.89`). Có thể dùng IP trực tiếp cho test nhưng HTTPS và PWA khuyến nghị dùng domain.
- **Truy cập:** SSH vào VPS với quyền sudo.

---

## 2. Cài đặt môi trường trên VPS

### 2.1 Cập nhật hệ thống và cài Node.js (LTS 20.x)

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x
npm -v
```

### 2.2 Cài Nginx (và Certbot nếu dùng SSL Let's Encrypt)

```bash
sudo apt install -y nginx
```

Nếu bạn dùng **SSL Let's Encrypt** (mục 8.2) thay vì Cloudflare Origin Certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2.3 Cài PM2 (quản lý process Node.js)

```bash
sudo npm install -g pm2
```

### 2.4 (Tùy chọn) Cài Git nếu deploy bằng clone

```bash
sudo apt install -y git
```

---

## 3. Đưa code lên VPS

### 3.1 Cách 1: Clone từ Git

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone https://github.com/your-org/phim.git cineviet
cd cineviet
```

### 3.2 Cách 2: Upload qua SCP/SFTP

- Trên máy local: nén thư mục dự án (loại trừ `node_modules`, `.env`, `.git` nếu không cần).
- Upload file nén lên VPS (vd. `/home/ubuntu/`), giải nén vào `/var/www/cineviet` (tạo thư mục nếu chưa có).

```bash
# Trên VPS, ví dụ sau khi upload phim.zip
cd /var/www
sudo mkdir -p cineviet
sudo chown $USER:$USER cineviet
unzip -o ~/phim.zip -d cineviet
cd cineviet
```

### 3.3 Cấu trúc thư mục sau khi đưa code

```
/var/www/cineviet/
├── backend/           # Node/Express API
│   ├── src/
│   ├── scripts/      # initDb.js, resetUsers.js, ...
│   ├── data/         # (sẽ tạo khi chạy db:init) phim.db
│   ├── uploads/      # (sẽ tạo khi cần) ảnh upload, quảng cáo
│   ├── package.json
│   └── .env          # (tạo mới, xem mục 4)
├── frontend/         # React/Vite
│   ├── src/
│   ├── public/       # favicon.svg, manifest.json, icon-192.png, icon-512.png
│   ├── dist/         # (sẽ tạo khi build) Nginx trỏ root vào đây
│   └── package.json
└── (các file .md, ...)
```

---

## 4. Cấu hình Backend

### 4.1 Tạo thư mục data và uploads

```bash
cd /var/www/cineviet/backend
mkdir -p data uploads uploads/ads
```

- **data:** Chứa file SQLite `phim.db` (tạo khi chạy `npm run db:init`).
- **uploads:** Ảnh poster/backdrop upload từ admin, file quảng cáo (ads).

### 4.2 Biến môi trường (.env)

Tạo file `.env` trong thư mục **backend**:

```bash
cd /var/www/cineviet/backend
nano .env
```

Nội dung **tối thiểu** (bắt buộc cho chạy production):

```env
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://cineviet.vn
JWT_SECRET=thay-bang-chuoi-bi-mat-dai-ngau-nhien
```

Tạo chuỗi bí mật cho JWT:

```bash
openssl rand -base64 32
```

Dán kết quả vào `JWT_SECRET`.

**Ví dụ .env tối thiểu** (bắt buộc):

```env
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://cineviet.vn
JWT_SECRET=your-output-from-openssl-rand-base64-32
```

Các biến tùy chọn (Turnstile, SMTP, Google, Facebook, TMDB, …) xem chi tiết tại **[4.3 Cấu hình từng tính năng](#43-cấu-hình-từng-tính-năng-turnstile-email-google-facebook--)** bên dưới. File mẫu đầy đủ: `backend/.env.example`.

- **FRONTEND_URL:** Đúng domain production (https://...), dùng cho CORS, OAuth callback, sitemap, email.

### 4.3 Cấu hình từng tính năng (Turnstile, Email, Google, Facebook, …)

Các mục dưới đây là **tùy chọn**. Bạn chỉ cấu hình những gì cần dùng. Mọi biến môi trường đều đặt trong **backend/.env** (và với Turnstile cần thêm **frontend/.env** khi build).

---

#### 4.3.1 Cloudflare Turnstile (Captcha đăng nhập / đăng ký)

**Ở đâu cấu hình:** Backend và Frontend (cả hai phải khớp thì captcha mới bật).

- **Lấy key:** Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Turnstile** → tạo widget → lấy **Site Key** (public) và **Secret Key** (private).
- **Backend** (`backend/.env`): thêm  
  `TURNSTILE_SECRET=<Secret Key từ Cloudflare>`
- **Frontend** (trước khi build): tạo hoặc sửa `frontend/.env` (hoặc `frontend/.env.production`), thêm  
  `VITE_TURNSTILE_SITE_KEY=<Site Key từ Cloudflare>`  
  Sau đó chạy lại `npm run build`. Nếu không set Site Key, ô captcha sẽ không hiển thị; nếu backend có `TURNSTILE_SECRET` mà frontend không gửi token thì đăng nhập/đăng ký sẽ bị từ chối.

**Lưu ý:** Ứng dụng đã load sẵn script Turnstile từ `https://challenges.cloudflare.com/turnstile/v0/api.js` trong `frontend/index.html`. Chỉ cần cấu hình key là đủ.

---

#### 4.3.2 Gửi email mã xác nhận khi đăng ký

**Ở đâu cấu hình:** Chỉ **backend** — file `backend/.env`.

Khi người dùng đăng ký, hệ thống gửi email chứa mã PIN 6 số để xác thực. Để gửi được email, cấu hình SMTP trong `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=your@gmail.com
SITE_NAME=CineViet
```

- **Gmail:** Bật xác minh 2 bước, tạo [Mật khẩu ứng dụng](https://support.google.com/accounts/answer/185833), dùng mật khẩu đó cho `SMTP_PASS`.
- **SMTP khác:** Đổi `SMTP_HOST`, `SMTP_PORT` (465 thì thêm `SMTP_SECURE=1`). Có thể dùng `SMTP_PASSWORD` thay cho `SMTP_PASS`.

Nếu **không** cấu hình SMTP (bỏ trống `SMTP_USER` / `SMTP_HOST`), đăng ký vẫn hoạt động nhưng email không gửi đi; trong môi trường dev, mã PIN có thể in ra console.

---

#### 4.3.3 Đăng nhập bằng Google (OAuth)

**Ở đâu cấu hình:** **Backend** — file `backend/.env`. Không cần biến môi trường ở frontend.

- **Tạo OAuth Client:** Vào [Google Cloud Console](https://console.cloud.google.com/) → chọn project → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID** → loại **Web application**. Đặt **Authorized redirect URIs** là URL callback của backend, ví dụ:  
  `https://cineviet.vn/api/auth/google/callback`  
  (đúng domain và path `/api/auth/google/callback`).
- **Backend** (`backend/.env`):

```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=https://cineviet.vn/api/auth/google/callback
```

`GOOGLE_CALLBACK_URL` phải trùng với redirect URI đã khai báo trên Google (và phải là URL mà Nginx proxy `/api/` tới backend, thường là `https://<domain>/api/auth/google/callback`).

Sau khi cấu hình, restart backend (vd. `pm2 restart cineviet-api`). Nút "Đăng nhập bằng Google" trên frontend sẽ dùng các giá trị này qua API.

---

#### 4.3.4 Đăng nhập bằng Facebook (OAuth)

**Ở đâu cấu hình:** **Backend** — file `backend/.env`.

- **Tạo app:** [Facebook for Developers](https://developers.facebook.com/) → **My Apps** → tạo app → **Facebook Login** → **Settings** → **Valid OAuth Redirect URIs** thêm:  
  `https://cineviet.vn/api/auth/facebook/callback`
- **Backend** (`backend/.env`):

```env
FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx
FACEBOOK_CALLBACK_URL=https://cineviet.vn/api/auth/facebook/callback
```

Restart backend sau khi sửa.

---

#### 4.3.5 Google Analytics 4 (GA4)

**Ở đâu cấu hình:** **Trong trang Admin** của site, không cần sửa file .env.

- Vào [Google Analytics](https://analytics.google.com/) → Admin → **Data Streams** → chọn stream web → lấy **Measurement ID** (dạng `G-XXXXXXXXXX`).
- Trong trang **Admin** của CineViet → **Cài đặt** → mục **Google Analytics 4** → dán Measurement ID và lưu. Ứng dụng sẽ dùng ID này để gửi pageview (cấu hình lưu trong database, không dùng biến môi trường frontend).

---

#### 4.3.6 Các API khác (TMDB, OMDB, OpenAI)

**Ở đâu cấu hình:** **Backend** — file `backend/.env`.

| Tính năng | Biến môi trường | Lấy key / ghi chú |
|-----------|-----------------|--------------------|
| TMDB (cast, ảnh khi crawl) | `TMDB_API_KEY` | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| OMDb (IMDb khi TMDB thiếu) | `OMDB_API_KEY` | [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) |
| OpenAI (trang AI gợi ý phim) | `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

Để trống thì tính năng tương ứng không dùng (vd. không gọi OpenAI thì trang gợi ý phim vẫn mở nhưng không trả lời).

---

### 4.4 Cài dependency và khởi tạo database

```bash
cd /var/www/cineviet/backend
npm ci --omit=dev
npm run db:init
```

- `db:init` tạo bảng, seed thể loại/quốc gia, **tạo tài khoản admin mặc định**: email `admin@phim.local`, mật khẩu `admin123`. Sau khi deploy có thể đổi mật khẩu trong trang admin hoặc dùng script reset user (mục 10).

### 4.5 Chạy thử

```bash
npm start
```

Từ máy bạn mở: `http://IP_VPS:5000/api/health`. Nếu trả về `{"ok":true}` thì dừng (Ctrl+C) và chuyển sang chạy bằng PM2.

---

## 5. Chạy Backend bằng PM2

```bash
cd /var/www/cineviet/backend
pm2 start src/index.js --name cineviet-api
pm2 save
pm2 startup
```

- Làm theo lệnh in ra sau `pm2 startup` để PM2 tự chạy lại khi reboot.
- Kiểm tra: `pm2 status`, `pm2 logs cineviet-api`.

---

## 6. Build Frontend

### 6.1 Biến môi trường build (nếu cần)

- **VITE_API_URL:** Frontend và API cùng domain (vd. `https://cineviet.vn` và `https://cineviet.vn/api`) thì thường **để trống**. Chỉ set khi API ở domain khác, ví dụ trong `frontend/.env`: `VITE_API_URL=https://api.cineviet.vn`.
- **VITE_TURNSTILE_SITE_KEY:** Nếu đã bật Cloudflare Turnstile ở backend (mục [4.3.1](#431-cloudflare-turnstile-captcha-đăng-nhập--đăng-ký)), cần đặt Site Key trong `frontend/.env` (vd. `VITE_TURNSTILE_SITE_KEY=0x4AAA...`) rồi build lại; nếu không, ô captcha sẽ không hiện.

### 6.2 (Tùy chọn) Tạo icon PWA

Nếu đã đổi favicon/logo và muốn icon PWA (192x192, 512x512) đồng bộ:

```bash
cd /var/www/cineviet/frontend
npm ci
npm run build-pwa-icons
```

### 6.3 Build

```bash
cd /var/www/cineviet/frontend
npm ci
npm run build
```

Thư mục ra: `frontend/dist/` (chứa `index.html`, `assets/`, `favicon.svg`, `manifest.json`, `icon-192.png`, `icon-512.png`).

---

## 7. Cấu hình Nginx

### 7.1 Tạo file cấu hình site

```bash
sudo nano /etc/nginx/sites-available/cineviet
```

Thay `cineviet.vn` và đường dẫn cho đúng với domain và thư mục của bạn.

**Nội dung mẫu:**

```nginx
server {
    listen 80;
    server_name cineviet.vn www.cineviet.vn;
    root /var/www/cineviet/frontend/dist;
    index index.html;

    # Frontend SPA: mọi path trả về index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy tới Node
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Upload ảnh (poster, quảng cáo) từ backend
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO (xem chung, realtime)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # robots.txt và sitemap do backend phục vụ
    location = /robots.txt {
        proxy_pass http://127.0.0.1:5000/robots.txt;
        proxy_set_header Host $host;
    }
    location = /api/sitemap.xml {
        proxy_pass http://127.0.0.1:5000/api/sitemap.xml;
        proxy_set_header Host $host;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
}
```

### 7.2 Kích hoạt site và kiểm tra

```bash
sudo ln -sf /etc/nginx/sites-available/cineviet /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. SSL (HTTPS) – Let's Encrypt hoặc Cloudflare

Chọn **một trong hai** cách: dùng **Cloudflare** (SSL + CDN, dễ quản lý) hoặc **Let's Encrypt** (Certbot, không qua proxy).

---

### 8.1 Cách 1: SSL với Cloudflare (khuyến nghị nếu đã dùng Cloudflare)

Khi domain đã trỏ qua **Cloudflare** (nameserver trỏ về Cloudflare), bạn dùng **Origin Certificate** do Cloudflare cấp cho máy chủ gốc (VPS). Certificate này **chỉ dùng giữa Cloudflare và VPS**, không cần cài Certbot.

**Bước 1 – Tạo Origin Certificate trên Cloudflare**

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/) → chọn domain (vd. `cineviet.vn`).
2. Vào **SSL/TLS** → **Origin Server**.
3. Bấm **Create Certificate**.
4. Chọn **Generate private key and CSR with Cloudflare** (mặc định).
5. **Hostnames:** để `*.cineviet.vn` và `cineviet.vn` (hoặc domain của bạn).
6. **Validity:** 15 years.
7. Bấm **Create** → sao chép **Origin Certificate** (khối PEM) và **Private Key** (khối PEM) ra file tạm; bạn sẽ dán vào VPS.

**Bước 2 – Lưu certificate và key trên VPS**

```bash
sudo mkdir -p /etc/nginx/ssl
sudo nano /etc/nginx/ssl/cloudflare-origin.pem
```

Dán nội dung **Origin Certificate** (từ `-----BEGIN CERTIFICATE-----` đến `-----END CERTIFICATE-----`), lưu (Ctrl+O, Enter, Ctrl+X).

```bash
sudo nano /etc/nginx/ssl/cloudflare-origin.key
```

Dán nội dung **Private Key** (từ `-----BEGIN PRIVATE KEY-----` đến `-----END PRIVATE KEY-----`), lưu.

```bash
sudo chmod 600 /etc/nginx/ssl/cloudflare-origin.key
```

**Bước 3 – Sửa Nginx listen 443 với SSL**

Mở file cấu hình site:

```bash
sudo nano /etc/nginx/sites-available/cineviet
```

**Thêm** hoặc sửa để có **hai** block `server`: một cho HTTP (80) redirect sang HTTPS, một cho HTTPS (443). Ví dụ:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name cineviet.vn www.cineviet.vn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name cineviet.vn www.cineviet.vn;

    ssl_certificate     /etc/nginx/ssl/cloudflare-origin.pem;
    ssl_certificate_key /etc/nginx/ssl/cloudflare-origin.key;

    root /var/www/cineviet/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location = /robots.txt {
        proxy_pass http://127.0.0.1:5000/robots.txt;
        proxy_set_header Host $host;
    }
    location = /api/sitemap.xml {
        proxy_pass http://127.0.0.1:5000/api/sitemap.xml;
        proxy_set_header Host $host;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
}
```

**Bước 4 – Áp dụng cấu hình**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Bước 5 – Cấu hình SSL trên Cloudflare**

Trong Cloudflare: **SSL/TLS** → **Overview** → chọn chế độ **Full (strict)** (mã hóa từ trình duyệt đến Cloudflare và từ Cloudflare đến origin với certificate bạn vừa cài).

**Lưu ý:** Origin Certificate có hiệu lực 15 năm; khi gần hết hạn bạn tạo certificate mới trên Cloudflare và thay file `.pem`/`.key` trên VPS rồi `sudo systemctl reload nginx`.

---

### 8.2 Cách 2: SSL với Let's Encrypt (Certbot)

Dùng khi **không** qua Cloudflare proxy (domain trỏ A record thẳng về IP VPS) hoặc khi bạn muốn SSL do Let's Encrypt cấp.

Cần đã cài Certbot (mục 2.2):

```bash
sudo certbot --nginx -d cineviet.vn -d www.cineviet.vn
```

Làm theo hướng dẫn (email, đồng ý điều khoản). Certbot sẽ sửa file Nginx để listen 443 và cấu hình certificate.

Kiểm tra gia hạn tự động:

```bash
sudo certbot renew --dry-run
```

---

## 9. Firewall

Chỉ mở SSH, Nginx (80, 443). **Không** mở cổng 5000 ra ngoài.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 10. Xóa toàn bộ user và tạo lại tài khoản admin

Khi cần **xóa hết user hiện tại** (kể cả admin cũ) và **tạo một tài khoản admin mới** (vd. đổi email/mật khẩu admin):

### 10.1 Chạy script reset user (trên VPS)

```bash
cd /var/www/cineviet/backend
node scripts/resetUsers.js
```

Hoặc dùng npm script:

```bash
cd /var/www/cineviet/backend
npm run reset-users
```

**Script sẽ:**

1. Xóa dữ liệu liên quan user: `comment_reports`, `watch_reports`, `login_log`, `user_ratings`, `user_favorites`, `watch_history`, `comments`.
2. Xóa toàn bộ bản ghi trong bảng `users`.
3. Tạo **một tài khoản admin mới**:
   - **Email mặc định:** `admin@phim.local`
   - **Mật khẩu mặc định:** `admin123`

**Lưu ý:** Phim, thể loại, quốc gia, cài đặt hệ thống **không bị xóa**. Chỉ mất toàn bộ user và dữ liệu gắn với user (lịch sử xem, yêu thích, bình luận, v.v.).

### 10.2 Tạo admin với email/mật khẩu tùy chọn

Dùng biến môi trường khi chạy script:

**Linux/macOS:**

```bash
cd /var/www/cineviet/backend
ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD=YourSecurePass123 node scripts/resetUsers.js
```

**Windows (PowerShell):**

```powershell
cd backend
$env:ADMIN_EMAIL="admin@yourdomain.com"; $env:ADMIN_PASSWORD="YourSecurePass123"; node scripts/resetUsers.js
```

Sau khi chạy xong, đăng nhập trang admin bằng email và mật khẩu vừa đặt (mặc định hoặc từ env). Nên đổi mật khẩu lần đầu trong trang admin (profile) nếu dùng mặc định.

---

## 11. Kiểm tra sau deploy

1. **Trang chủ:** `https://cineviet.vn` → load đúng, không lỗi console.
2. **API:** `https://cineviet.vn/api/health` → `{"ok":true}`.
3. **Upload ảnh:** `https://cineviet.vn/uploads/...` (nếu có ảnh) → trả về ảnh.
4. **robots.txt:** `https://cineviet.vn/robots.txt` → có dòng Sitemap trỏ đúng URL.
5. **Sitemap:** `https://cineviet.vn/api/sitemap.xml` → trả về XML.
6. **Đăng nhập / đăng ký / xem phim:** Test luồng chính.
7. **Trang admin:** `https://cineviet.vn/admin` → đăng nhập bằng tài khoản admin (sau `db:init` hoặc sau `reset-users`).
8. **PWA:** Chrome DevTools → Application → Manifest, Service Worker (khi mở qua HTTPS).

---

## 12. Cập nhật bản mới

```bash
cd /var/www/cineviet
git pull
# hoặc upload code mới và giải nén

# Backend
cd backend
npm ci --omit=dev
pm2 restart cineviet-api

# Frontend
cd ../frontend
npm ci
npm run build
```

Nginx đã trỏ root tới `frontend/dist`, không cần restart Nginx. Nếu đổi **CACHE_NAME** trong Service Worker (vd. trong `frontend/public/sw.js` hoặc Vite PWA config), build lại frontend để user nhận bản PWA mới.

---

## 13. Tóm tắt & Checklist

| Bước | Nội dung |
|------|----------|
| 1 | VPS Ubuntu, cài Node 20, Nginx, PM2; Certbot chỉ cần nếu dùng SSL Let's Encrypt (mục 8.2) |
| 2 | Đưa code lên `/var/www/cineviet` (git clone hoặc upload) |
| 3 | Backend: tạo `backend/.env` (bắt buộc: PORT, FRONTEND_URL, JWT_SECRET; tùy chọn: Turnstile, SMTP, Google, Facebook, API — xem mục 4.3) |
| 4 | Backend: `mkdir -p data uploads uploads/ads`, `npm ci --omit=dev`, `npm run db:init` |
| 5 | Backend: `pm2 start src/index.js --name cineviet-api`, `pm2 save`, `pm2 startup` |
| 6 | Frontend: tạo `frontend/.env` nếu dùng Turnstile (VITE_TURNSTILE_SITE_KEY) hoặc API khác domain; `npm ci`, (tùy chọn) `npm run build-pwa-icons`, `npm run build` |
| 7 | Nginx: root = `frontend/dist`, proxy `/api/`, `/uploads/`, `/socket.io/`, `/robots.txt`, `/api/sitemap.xml` |
| 8 | SSL: Cloudflare Origin Certificate (mục 8.1) hoặc Let's Encrypt `certbot --nginx -d your-domain` (mục 8.2) |
| 9 | UFW: mở 80, 443, SSH; không mở 5000 |
| 10 | (Khi cần) Xóa hết user + tạo admin mới: `cd backend && npm run reset-users` (hoặc set ADMIN_EMAIL, ADMIN_PASSWORD) |

**Tài liệu liên quan:**

- **HUONG_DAN_PWA.md** — Cấu hình PWA, Service Worker.
- **HUONG_DAN_PWA_NGUOI_DUNG.md** — Hướng dẫn người dùng cài app lên màn hình.
- **DANH_GIA_DU_AN_VA_SEO.md** — SEO, Search Console, Sitemap.
