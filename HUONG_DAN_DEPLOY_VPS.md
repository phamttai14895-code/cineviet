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
11. [Kiểm tra sau deploy](#11-kiểm-tra-sau-deploy) — *gồm [11.1 Gửi Sitemap lên Google Search Console](#111-gửi-sitemap-lên-google-search-console)*
12. [Cập nhật bản mới](#12-cập-nhật-bản-mới)
13. [Tóm tắt & Checklist](#13-tóm-tắt--checklist)
14. [Bảo mật: Không đẩy file nhạy cảm lên GitHub](#14-bảo-mật-không-đẩy-file-nhạy-cảm-lên-github)

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

**Nếu đăng nhập/đăng ký báo "Vui lòng hoàn thành xác minh":** Backend đang bật Turnstile (`TURNSTILE_SECRET` có giá trị) nhưng frontend không gửi token (không có ô captcha). Chọn một trong hai:
- **Cách 1 – Tắt Turnstile:** Trong `backend/.env` trên VPS, xóa hoặc để trống `TURNSTILE_SECRET` (ví dụ `TURNSTILE_SECRET=`), sau đó `pm2 restart cineviet-api`. Đăng nhập/đăng ký sẽ không cần captcha.
- **Cách 2 – Bật Turnstile đúng:** Thêm `VITE_TURNSTILE_SITE_KEY=<Site Key>` vào `frontend/.env`, chạy `npm run build` lại, deploy bản build mới. Khi đó trang sẽ hiện ô captcha và gửi token khi đăng nhập/đăng ký.

**Đã cấu hình đủ Site Key (frontend) và Secret (backend) nhưng vẫn lỗi:**
1. **Frontend phải build lại sau khi thêm key:** Biến `VITE_TURNSTILE_SITE_KEY` được nhúng vào lúc build. Nếu bạn thêm key vào `frontend/.env` sau khi đã build, cần chạy lại `npm run build` và deploy lại thư mục `dist`.
2. **Domain trong Cloudflare:** Vào Cloudflare Dashboard → Turnstile → widget của bạn → mục **Domains** phải chứa domain thật (vd. `cineviet.live`). Nếu chỉ có localhost thì token từ production sẽ bị từ chối.
3. **Site Key và Secret phải cùng một widget:** Mỗi widget có một cặp Site Key + Secret. Đảm bảo không lẫn key của widget khác.
4. **Xem log backend khi submit:** Trên VPS chạy `pm2 logs cineviet-api`. Khi bạn bấm Đăng nhập, nếu Cloudflare từ chối token sẽ có dòng `[Turnstile] verify failed:` kèm mã lỗi (vd. `invalid-input-secret`, `invalid-input-response`, `timeout-or-duplicate`). Dựa vào đó kiểm tra Secret Key và domain.

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

#### 4.3.6 Các API khác (TMDB, AI gợi ý phim)

**Ở đâu cấu hình:** **Backend** — file `backend/.env`.

| Tính năng | Biến môi trường | Lấy key / ghi chú |
|-----------|-----------------|--------------------|
| TMDB (cast, ảnh khi crawl) | `TMDB_API_KEY` | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| **AI gợi ý phim (chọn một hãng)** | | |
| Hãng AI | `AI_PROVIDER` | `openai` (mặc định) hoặc `gemini`. |
| OpenAI (ChatGPT) | `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Kèm `OPENAI_MODEL` (mặc định `gpt-4o-mini`). |
| Google (Gemini) | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Kèm `GEMINI_MODEL` (mặc định `gemini-1.5-flash`). |

**Nên dùng hãng AI nào cho tính năng gợi ý / hỏi đáp phim?**

- **Google Gemini** (`AI_PROVIDER=gemini`, `GEMINI_API_KEY`): free tier rộng, tiếng Việt tốt, ổn cho production. Gợi ý dùng nếu muốn tiết kiệm chi phí hoặc không dùng OpenAI.
- **OpenAI** (`OPENAI_API_KEY`, mặc định nếu không set `AI_PROVIDER=gemini`): API ổn định, chất lượng tốt; trả phí theo token. Phù hợp nếu bạn đã có sẵn tài khoản OpenAI.

Chỉ cần cấu hình **một** trong hai: OpenAI hoặc Gemini. Để trống cả hai thì trang gợi ý phim vẫn mở nhưng không gọi AI (chỉ gợi ý theo bộ lọc).

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

Trên **chính VPS** (terminal khác hoặc sau khi đã chạy backend), kiểm tra:

```bash
curl -s http://127.0.0.1:5000/api/health
```

Phải trả về `{"ok":true}`. Sau đó từ máy bạn mở: `http://IP_VPS:5000/api/health` (nếu đã mở cổng 5000 tạm thời). Nếu OK thì dừng backend (Ctrl+C) và chuyển sang chạy bằng PM2.

**Nếu `curl` không trả về gì hoặc "Connection refused":**

1. **Backend có đang chạy không?** Trong terminal chạy `npm start` phải thấy dòng `Backend running at http://0.0.0.0:5000` và không có lỗi đỏ. Nếu process thoát ngay hoặc báo lỗi (thiếu `.env`, thiếu file DB, v.v.) thì xử lý lỗi đó trước.
2. **Có process nào nghe cổng 5000 không?** Chạy: `sudo ss -tlnp | grep 5000` (hoặc `sudo netstat -tlnp | grep 5000`). Nếu trống thì backend chưa listen (chưa start hoặc crash).
3. **Thử curl có verbose:** `curl -v http://127.0.0.1:5000/api/health` để xem là "Connection refused" hay "Connected" và status HTTP.

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
    server_name cineviet.live www.cineviet.live;
    root /var/www/cineviet/frontend/dist;
    index index.html;

    # Frontend SPA: mọi path trả về index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy tới Node (timeout dài cho crawl/import — tránh 504)
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
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
    server_name cineviet.live www.cineviet.live;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name cineviet.live www.cineviet.live;

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
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
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

### 11.1 Gửi Sitemap lên Google Search Console

Sau khi site chạy ổn định và có **robots.txt** + **sitemap.xml** trả về đúng (mục 11), nên khai báo Sitemap trong Google Search Console để Google thu thập và lập chỉ mục trang nhanh hơn.

**Bước 1: Thêm property (nếu chưa có)**  
- Vào [Google Search Console](https://search.google.com/search-console).  
- **Thêm tài nguyên** → chọn **Thuộc tính URL** (hoặc “Tiền tố URL”).  
- Nhập đúng domain production, ví dụ: `https://cineviet.vn`.  
- Xác minh quyền sở hữu theo hướng dẫn (DNS, file HTML, meta tag, Google Analytics, v.v.).

**Bước 2: Mở mục Sitemap**  
- Trong Search Console, chọn property vừa thêm.  
- Menu bên trái: **Lập chỉ mục** → **Sitemap**.

**Bước 3: Gửi URL Sitemap**  
- Ô **Thêm sitemap mới** nhập đúng URL sitemap của CineViet:  
  `https://cineviet.vn/api/sitemap.xml`  
  (thay `cineviet.vn` bằng domain thực tế của bạn).  
- Bấm **Gửi**.

**Bước 4: Kiểm tra**  
- Sau vài phút đến vài giờ, trạng thái sitemap sẽ hiển thị (Đã gửi / Đã lập chỉ mục / Lỗi).  
- Nếu báo lỗi: kiểm tra lại URL (đúng `/api/sitemap.xml`), HTTPS, và Nginx đã proxy đúng tới backend (mục 7).  
- **Lập chỉ mục** → **Trang** để xem số trang đã được Google phát hiện và lập chỉ mục.

**Lưu ý:**  
- **robots.txt** của CineViet đã có dòng `Sitemap: https://<domain>/api/sitemap.xml` (backend sinh từ `FRONTEND_URL`). Google có thể tự tìm sitemap qua robots.txt, nhưng khai báo thủ công trong Search Console giúp theo dõi trạng thái và lỗi rõ ràng hơn.  
- Sitemap XML do backend phục vụ tại `GET /api/sitemap.xml` (danh sách URL trang chủ, danh mục, phim, v.v.). Đảm bảo Nginx proxy `/api/sitemap.xml` về backend như trong mục 7.

### 11.2 Crawl lỗi 504 (Request failed with status code 504)

**Nguyên nhân:** Job crawl (Admin → Crawl → Chạy crawl) gửi nhiều trang và import từng phim, có thể chạy vài phút. Nginx mặc định đợi backend tối đa 60 giây; hết thời gian Nginx trả **504 Gateway Timeout**.

**Cách xử lý:**

1. **Nginx:** Trong `location /api/` (cả HTTP và HTTPS), thêm:
   ```nginx
   proxy_connect_timeout 60s;
   proxy_send_timeout 600s;
   proxy_read_timeout 600s;
   ```
   (Mẫu trong mục 7.1 và 8.1 đã có các dòng này.) Sau đó: `sudo nginx -t` rồi `sudo systemctl reload nginx`.

2. **Frontend:** Request crawl đã được cấu hình timeout 10 phút (600000 ms). Nếu vẫn bị lỗi trước 10 phút, kiểm tra Nginx (bước 1) hoặc Cloudflare (nếu dùng): Cloudflare free có giới hạn 100 giây cho request đến origin — job crawl rất lâu có thể cần chạy từ mạng nội bộ hoặc tăng timeout phía Cloudflare (plan trả phí).

3. **Giảm tải:** Trong Admin → Crawl, giảm **Đến trang** (vd. 1–3 trang), ít nguồn hơn, hoặc bật **Tự động crawl** để job chạy nền theo lịch (không qua trình duyệt, không bị 504 từ Nginx/Cloudflare).

### 11.3 Auto crawl toàn bộ phim KKPhim

Để **tự động crawl toàn bộ phim** từ API KKPhim (PhimAPI):

**Cách 1 – Crawl thủ công một lần đến hết**

1. Vào **Admin** → **Crawl**.
2. Phần **Crawl thủ công**: tick **Crawl đến hết trang (toàn bộ phim KKPhim, tự dừng khi hết dữ liệu)**.
3. Bấm **Bắt đầu crawl**. Backend sẽ lần lượt lấy từ trang 1, 2, 3, … đến khi gặp trang không còn phim thì dừng (tối đa 500 trang). Lưu ý: job có thể chạy rất lâu, dễ bị 504 nếu gọi qua Nginx/Cloudflare; nên chạy từ VPS (SSH) hoặc dùng Cách 2.

**Cách 2 – Auto crawl định kỳ (khuyến nghị)**

1. Vào **Admin** → **Crawl** → phần **Auto crawl**.
2. Bật **Bật auto crawl**.
3. Chọn **Chạy mỗi** (vd. 30 phút hoặc 1 giờ).
4. Tick **Crawl đến hết trang (auto chạy toàn bộ mỗi lần)** — mỗi lần chạy sẽ crawl từ trang 1 đến khi hết dữ liệu.
5. Bấm **Lưu cấu hình auto**. Job sẽ chạy nền trên server (không qua trình duyệt), tránh 504, và tự cập nhật toàn bộ phim theo lịch.

**Auto crawl không chạy?** Kiểm tra: (1) Đã bật **Bật auto crawl** và bấm **Lưu cấu hình auto** (nếu chỉ bật mà không Lưu thì sau khi restart server sẽ không chạy). (2) Restart backend: `pm2 restart cineviet-api`. (3) Xem log: `pm2 logs cineviet-api` — nếu thấy `[AutoCrawl] Started, interval: 30 min` là đã bật; nếu thấy `[AutoCrawl] Chưa bật...` thì vào Admin bật lại và Lưu.

**Cách 3 – Crawl theo khoảng trang cố định**

- Không tick "Crawl đến hết trang", đặt **Trang từ** 1 và **đến trang** N (1–500). Mỗi lần chỉ crawl N trang đầu; tăng dần N hoặc bật auto với N lớn để dần cover hết.

---

## 12. Cập nhật bản mới

```bash
cd /var/www/cineviet
git pull origin main
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

Nginx đã trỏ root tới `frontend/dist`, không cần restart Nginx.

### 12.1. Nếu `git pull` báo conflict vì `.env` hoặc file DB

Git có thể báo: *"Your local changes to the following files would be overwritten by merge: backend/.env, backend/data/phim.db-shm, backend/data/phim.db-wal"*. Trên VPS cần **giữ nguyên** file `.env` và DB của server, chỉ cập nhật code. Làm lần lượt:

```bash
cd /var/www/cineviet

# 1) Backup .env (phòng khi cần)
cp backend/.env backend/.env.bak

# 2) Stash các file local để pull được
git stash push -m "server env and db" backend/.env backend/data/phim.db-shm backend/data/phim.db-wal

# 3) Pull code mới
git pull origin main

# 4) Lấy lại .env và file DB của server (không ghi đè bằng bản từ repo)
git stash pop
```

Nếu `git stash pop` báo conflict ở `backend/.env`: giữ bản trên server (bản bạn vừa pop ra). Chạy:

```bash
git checkout --theirs backend/.env
git add backend/.env
git stash drop
```

Sau đó kiểm tra `backend/.env` đúng cấu hình VPS rồi mới restart: `pm2 restart cineviet-api`.

### 12.2. Trên máy local (khi `git pull` báo overwrite `phim.db-shm` / `phim.db-wal`)

Trên máy dev, nếu pull báo *"Your local changes would be overwritten by merge: backend/data/phim.db-shm, backend/data/phim.db-wal"*:

- **Cách 1:** Tạm đổi tên hai file (SQLite sẽ tạo lại khi chạy backend), rồi pull (Windows: `ren`, Linux/Mac: `mv`):
  ```bash
  cd backend/data
  ren phim.db-shm phim.db-shm.bak
  ren phim.db-wal phim.db-wal.bak
  cd ../..
  git pull origin main
  ```
- **Cách 2:** Bỏ staged thay đổi với các file đó rồi pull (nếu bạn đã `git rm --cached` nhưng chưa commit):
  ```bash
  git restore --staged backend/.env backend/data/phim.db-shm backend/data/phim.db-wal
  git restore backend/data/phim.db-shm backend/data/phim.db-wal
  git pull origin main
  ```

Sau khi pull, repo sẽ không còn track `.env` và file `*.db-shm` / `*.db-wal`; file local vẫn nằm trong thư mục và được `.gitignore` bỏ qua.

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

---

## 14. Bảo mật: Không đẩy file nhạy cảm lên GitHub

Để **chặn** không đẩy file chứa nội dung nhạy cảm (API key, mật khẩu, JWT secret, v.v.) lên GitHub:

### 14.1 Dùng `.gitignore` (đã có trong repo)

- File **`.gitignore`** ở thư mục gốc đã khai báo bỏ qua:
  - **`.env`**, **`backend/.env`**, **`frontend/.env`** và các biến thể (`.env.local`, `.env.production`, …).
  - File key/secret: `*.pem`, `*.key`, `secrets/`.
  - Thư mục **`node_modules/`**, **`dist/`**, **`uploads/`**, v.v.
- Chỉ **`.env.example`** (placeholder, không có giá trị thật) nên được commit. Khi clone repo, copy thành `.env` rồi điền secret thật trên máy/VPS.

### 14.2 Pre-commit hook (chặn commit file nhạy cảm)

Repo có sẵn hook **pre-commit** để **tự động chặn** commit nếu có file nhạy cảm (`.env`, `*.pem`, `*.key`, `secrets/`, …):

- **Cài hook** (chạy một lần sau khi clone hoặc trên máy mới):
  - **Windows (cmd):** `scripts\setup-hooks.bat`
  - **Windows (PowerShell):** `.\scripts\setup-hooks.ps1`
  - **Linux/macOS hoặc Git Bash:** `sh scripts/setup-hooks.sh`
- Hook nằm ở `scripts/git-hooks/pre-commit`. Khi bạn `git add` rồi `git commit`, nếu có file bị cấm thì commit sẽ **bị từ chối** và hiện thông báo. Chỉ commit **`.env.example`** (placeholder), không commit `.env` hoặc key/secret.

### 14.3 Trước khi commit/push

- **Không** copy nội dung từ `.env` vào `.env.example`.
- Chạy `git status` và kiểm tra không có file `.env`, `*.key`, `*.pem` trong danh sách staged.
- Nếu đã lỡ commit file nhạy cảm: xóa file khỏi Git (và sửa lịch sử nếu cần), thêm vào `.gitignore`, rồi **đổi ngay** các secret đã lộ (tạo API key mới, đổi mật khẩu, JWT secret mới).

### 14.4 GitHub Push Protection

- GitHub có thể **từ chối push** nếu phát hiện secret (API key, OAuth client secret, …) trong commit. Khi đó cần sửa commit (xóa secret, dùng placeholder trong `.env.example`) rồi push lại.
