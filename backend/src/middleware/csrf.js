/**
 * CSRF double-submit cookie: tạo token, gửi qua cookie (đọc được bởi JS) và kiểm tra header X-CSRF-Token trên POST/PUT/PATCH/DELETE.
 * Bật khi ENABLE_CSRF=1. GET /api/settings và GET /api/csrf trả thêm csrfToken để frontend gửi kèm header.
 */
import crypto from 'crypto';

const ENABLE_CSRF = process.env.ENABLE_CSRF === '1';
const COOKIE_NAME = 'csrf_token';
const HEADER_NAME = 'X-CSRF-Token';

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getTokenFromCookie(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * Middleware: với GET/HEAD/OPTIONS chỉ cấp cookie (nếu chưa có); với POST/PUT/PATCH/DELETE kiểm tra header khớp cookie.
 */
export function csrfMiddleware(req, res, next) {
  if (!ENABLE_CSRF) {
    res.locals.csrfToken = null;
    return next();
  }

  const method = (req.method || 'GET').toUpperCase();
  const isSafe = ['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (isSafe) {
    let token = getTokenFromCookie(req);
    if (!token) {
      token = generateToken();
      res.cookie(COOKIE_NAME, token, {
        httpOnly: false, // để SPA có thể đọc (double-submit)
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });
    }
    res.locals.csrfToken = token;
    return next();
  }

  const cookieToken = getTokenFromCookie(req);
  const headerToken = (req.headers[HEADER_NAME.toLowerCase()] || '').trim();
  if (!cookieToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Token CSRF không hợp lệ hoặc thiếu. Gửi header X-CSRF-Token.' });
  }
  res.locals.csrfToken = cookieToken;
  next();
}

export { COOKIE_NAME, HEADER_NAME, ENABLE_CSRF };
