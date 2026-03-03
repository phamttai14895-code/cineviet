import passport from 'passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import db from '../config/db.js';

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'default-secret-change-me',
};

passport.use(
  new JwtStrategy(opts, (payload, done) => {
    const user = db.prepare('SELECT id, email, name, avatar, role FROM users WHERE id = ?').get(payload.userId);
    if (user) return done(null, user);
    return done(null, false);
  })
);

export const requireAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  })(req, res, next);
};

export const optionalAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) return next(err);
    req.user = user || null;
    next();
  })(req, res, next);
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

export default passport;
