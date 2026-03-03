import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Server } from 'socket.io';

import './config/passport.js';
import settingsConfig from './config/settings.js';
import requestLogger from './config/requestLogger.js';
import authRoutes from './routes/auth.js';
import moviesRoutes from './routes/movies.js';
import recommendationsRoutes from './routes/recommendations.js';
import userRoutes from './routes/user.js';
import adminRoutes, { startAutoCrawlTimer } from './routes/admin.js';
import crawlRoutes from './routes/crawl.js';
import actorsRoutes from './routes/actors.js';
import imageRoutes from './routes/image.js';
import homeRoutes from './routes/home.js';
import sitemapHandler from './routes/sitemap.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { registerWatchParty, getPublicRooms } from './watchParty.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Maintenance mode: trả 503 trừ health, settings, auth (để đăng nhập), admin (để tắt bảo trì)
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/settings') return next();
  if (req.path.startsWith('/auth')) return next();
  if (req.path.startsWith('/admin')) return next();
  if (settingsConfig.get('maintenance_mode') === '1') {
    return res.status(503).json({ error: 'Hệ thống đang bảo trì, vui lòng quay lại sau.' });
  }
  next();
});

// Rate limit: 1500 req/15 phút/IP mặc định; 4000 khi bật trong cài đặt. Loại trừ: health, settings, admin, image, ads/vast, user/progress
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_DEFAULT = 1500;
const RATE_MAX_STRICT = 4000;
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/settings') return next();
  if (req.path.startsWith('/admin')) return next();
  if (req.path === '/image') return next();
  if (req.path === '/ads/vast' || req.path.startsWith('/ads/zone/')) return next();
  if (req.path.startsWith('/user/progress')) return next(); // Đọc tiến độ xem
  if (req.method === 'POST' && /^\/movies\/[^/]+\/watch$/.test(req.path)) return next(); // Lưu tiến độ xem (gọi vài giây/lần)
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count += 1;
  const max = settingsConfig.get('rate_limit_enabled') === '1' ? RATE_MAX_STRICT : RATE_MAX_DEFAULT;
  if (entry.count > max) {
    res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Quá nhiều request, thử lại sau 15 phút.' });
  }
  next();
});

// Request logging for Server Logs (admin)
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const pathToLog = req.originalUrl || req.baseUrl + req.path || '';
    requestLogger.logRequest(req.method, pathToLog, res.statusCode, Date.now() - start);
  });
  next();
});

// CSRF: cấp token (cookie + res.locals) cho GET; kiểm tra X-CSRF-Token cho POST/PUT/PATCH/DELETE (khi ENABLE_CSRF=1)
app.use('/api', csrfMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/movies', moviesRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crawl', crawlRoutes);
app.use('/api/actors', actorsRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/home', homeRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const AD_ZONES_PUBLIC = ['popup', 'footer_banner', 'below_featured', 'sidebar_left', 'sidebar_right'];
const ADS_DIR = path.resolve(__dirname, '../uploads/ads');
const AD_ZONE_EXTS = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

function getAdZoneFileFromDisk(zone) {
  const current = (settingsConfig.get(`ad_${zone}_file`) || '').trim();
  if (current && !current.includes('..') && !current.includes('/')) {
    const p = path.join(ADS_DIR, current);
    if (fs.existsSync(p)) return current;
  }
  for (const ext of AD_ZONE_EXTS) {
    const p = path.join(ADS_DIR, zone + ext);
    if (fs.existsSync(p)) return zone + ext;
  }
  return null;
}

app.get('/api/settings', (req, res) => {
  // Seed: nếu DB chưa có file cho zone nào nhưng đã có file mẫu trên disk → ghi vào DB và bật zone
  for (const zone of AD_ZONES_PUBLIC) {
    const currentFile = (settingsConfig.get(`ad_${zone}_file`) || '').trim();
    if (!currentFile) {
      const fileFromDisk = getAdZoneFileFromDisk(zone);
      if (fileFromDisk) {
        settingsConfig.set(`ad_${zone}_file`, fileFromDisk);
        settingsConfig.set(`ad_${zone}_enabled`, '1');
      }
    }
  }
  const data = settingsConfig.getPublic();
  if (res.locals.csrfToken) data.csrfToken = res.locals.csrfToken;
  res.json(data);
});
app.get('/api/watch-party/rooms', (req, res) => {
  res.json({ rooms: getPublicRooms() });
});

// File VAST đã tải lên (phục vụ công khai cho player)
app.get('/api/ads/vast', (req, res) => {
  const vastPath = path.join(__dirname, '../uploads/ads/vast.xml');
  if (!fs.existsSync(vastPath)) return res.status(404).type('text/plain').send('No VAST file');
  res.type('application/xml');
  res.sendFile(vastPath);
});

app.get('/api/ads/zone/:zone', (req, res) => {
  const zone = req.params.zone;
  if (!AD_ZONES_PUBLIC.includes(zone)) return res.status(404).end();
  const filename = getAdZoneFileFromDisk(zone);
  if (!filename) return res.status(404).end();
  const filepath = path.join(ADS_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).end();
  if (filename.endsWith('.svg')) res.type('image/svg+xml');
  res.sendFile(filepath);
});

// Sitemap XML cho crawler (base URL từ FRONTEND_URL hoặc request)
app.get('/api/sitemap.xml', sitemapHandler);

// robots.txt — cho crawler biết Sitemap (URL tuyệt đối). Gọi từ cùng host backend hoặc cấu hình proxy trỏ /robots.txt về đây.
app.get('/robots.txt', (req, res) => {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '') || (req.protocol + '://' + (req.get('host') || 'localhost'));
  const baseUrl = base.startsWith('http') ? base : req.protocol + '://' + (req.get('host') || '');
  const sitemapUrl = baseUrl.replace(/\/$/, '') + '/api/sitemap.xml';
  res.type('text/plain');
  res.send(
    'User-agent: *\nAllow: /\n\n# Sitemap (nếu frontend và API cùng origin, dùng URL này)\nSitemap: ' + sitemapUrl + '\n'
  );
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const server = http.createServer(app);
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const io = new Server(server, {
  cors: { origin: frontendOrigin, methods: ['GET', 'POST'] },
});
registerWatchParty(io);

server.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  if (typeof startAutoCrawlTimer === 'function') startAutoCrawlTimer();
});
