import { Router } from 'express';
import passport from '../config/passport.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import db from '../config/db.js';
import settingsConfig from '../config/settings.js';
import { sendVerificationEmail } from '../utils/sendEmail.js';
import { verifyTurnstile, isTurnstileEnabled } from '../utils/turnstile.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/** Avatar mặc định khi tạo tài khoản mới (cờ Việt Nam) */
const DEFAULT_AVATAR_URL = 'https://flagcdn.com/w160/vn.png';

const signToken = (user) => jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

/** Tạo mã PIN 6 số */
function generatePin6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Thời gian hết hạn mã (10 phút), SQLite datetime */
function getExpiresAt() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 10);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
    body('name').trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (isTurnstileEnabled()) {
      const token = req.body?.turnstile_token?.trim();
      if (!token) return res.status(400).json({ error: 'Vui lòng hoàn thành xác minh.' });
      const ok = await verifyTurnstile(token, req.ip || req.socket?.remoteAddress);
      if (!ok) return res.status(400).json({ error: 'Xác minh không hợp lệ. Vui lòng thử lại.' });
    }
    const allowRegister = settingsConfig.get('allow_register') === '1';
    if (!allowRegister) return res.status(403).json({ error: 'Tạm thời không mở đăng ký tài khoản mới.' });
    const { email, password, name } = req.body;
    const reservedNames = ['admin', 'admin cineviet', 'administrator'];
    if (name && reservedNames.includes(String(name).trim().toLowerCase())) {
      return res.status(400).json({ error: 'Tên hiển thị này không được phép sử dụng.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email đã được sử dụng' });
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO users (email, password, name, avatar) VALUES (?, ?, ?, ?)').run(email, hash, name, DEFAULT_AVATAR_URL);
    const user = db.prepare('SELECT id, email, name, avatar, role FROM users WHERE id = ?').get(r.lastInsertRowid);

    const code = generatePin6();
    const expiresAt = getExpiresAt();
    try {
      db.prepare('UPDATE users SET email_verification_code = ?, email_verification_expires = ? WHERE id = ?').run(code, expiresAt, user.id);
      const sent = await sendVerificationEmail(email, code);
      if (!sent && process.env.NODE_ENV !== 'production') {
        console.log('[Dev] Email verification PIN for', email, ':', code);
      }
    } catch (e) {
      console.error('Verification email setup:', e?.message);
    }
    res.status(201).json({ user, token: signToken(user), requireEmailVerification: true });
  }
);

// Login
router.post('/login', async (req, res, next) => {
  if (isTurnstileEnabled()) {
    const token = req.body?.turnstile_token?.trim();
    if (!token) return res.status(400).json({ error: 'Vui lòng hoàn thành xác minh.' });
    const ok = await verifyTurnstile(token, req.ip || req.socket?.remoteAddress);
    if (!ok) return res.status(400).json({ error: 'Xác minh không hợp lệ. Vui lòng thử lại.' });
  }
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Email hoặc mật khẩu không đúng' });
    try {
      db.prepare('INSERT INTO login_log (user_id) VALUES (?)').run(user.id);
    } catch (_) { /* bảng login_log chưa có */ }
    const u = { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role: user.role };
    res.json({ user: u, token: signToken(u) });
  })(req, res, next);
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google` }),
  (req, res) => {
    try {
      db.prepare('INSERT INTO login_log (user_id) VALUES (?)').run(req.user.id);
    } catch (_) {}
    const user = { id: req.user.id, email: req.user.email, name: req.user.name, avatar: req.user.avatar, role: req.user.role };
    const token = signToken(user);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}`);
  }
);

// Facebook OAuth
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=facebook` }),
  (req, res) => {
    try {
      db.prepare('INSERT INTO login_log (user_id) VALUES (?)').run(req.user.id);
    } catch (_) {}
    const user = { id: req.user.id, email: req.user.email, name: req.user.name, avatar: req.user.avatar, role: req.user.role };
    const token = signToken(user);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}`);
  }
);

// Get current user (JWT)
router.get('/me', (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(user);
  })(req, res, next);
});

// Xác thực email bằng mã PIN 6 số (cần đăng nhập)
router.post(
  '/verify-email',
  (req, res, next) => {
    passport.authenticate('jwt', { session: false }, async (err, user) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const code = String(req.body?.code || '').trim().replace(/\D/g, '').slice(0, 6);
      if (code.length !== 6) return res.status(400).json({ error: 'Mã xác thực phải là 6 chữ số' });
      const row = db.prepare('SELECT email_verification_code, email_verification_expires FROM users WHERE id = ?').get(user.id);
      if (!row?.email_verification_code) return res.status(400).json({ error: 'Không có mã xác thực. Bấm Gửi lại để nhận mã mới.' });
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (row.email_verification_expires < now) return res.status(400).json({ error: 'Mã đã hết hạn. Bấm Gửi lại để nhận mã mới.' });
      if (row.email_verification_code !== code) return res.status(400).json({ error: 'Mã xác thực không đúng' });
      db.prepare('UPDATE users SET email_verification_code = NULL, email_verification_expires = NULL, email_verified = 1 WHERE id = ?').run(user.id);
      res.json({ ok: true });
    })(req, res, next);
  }
);

// Gửi lại mã xác thực (cần đăng nhập)
router.post(
  '/resend-verification',
  (req, res, next) => {
    passport.authenticate('jwt', { session: false }, async (err, user) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const code = generatePin6();
      const expiresAt = getExpiresAt();
      db.prepare('UPDATE users SET email_verification_code = ?, email_verification_expires = ? WHERE id = ?').run(code, expiresAt, user.id);
      const sent = await sendVerificationEmail(user.email, code);
      res.json({ ok: true, sent });
    })(req, res, next);
  }
);

export default router;
