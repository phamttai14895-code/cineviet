import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import bcrypt from 'bcryptjs';
import db from './db.js';

const DEFAULT_AVATAR_URL = 'https://flagcdn.com/w160/vn.png';

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    (email, password, done) => {
      const user = db.prepare('SELECT * FROM users WHERE email = ? AND provider IS NULL').get(email);
      if (!user) return done(null, false, { message: 'Email hoặc mật khẩu không đúng' });
      if ((user.status || 'active') === 'locked') return done(null, false, { message: 'Tài khoản đã bị khóa' });
      if (!bcrypt.compareSync(password, user.password)) return done(null, false, { message: 'Email hoặc mật khẩu không đúng' });
      const { password: _, ...safe } = user;
      return done(null, safe);
    }
  )
);

if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value;
        let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
          const stmt = db.prepare(`
            INSERT INTO users (email, name, avatar, provider, provider_id) VALUES (?, ?, ?, 'google', ?)
          `);
          const r = stmt.run(email || '', profile.displayName || 'User', profile.photos?.[0]?.value || DEFAULT_AVATAR_URL, profile.id);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
        } else if (!user.provider) {
          db.prepare('UPDATE users SET provider = ?, provider_id = ?, avatar = ? WHERE id = ?').run('google', profile.id, profile.photos?.[0]?.value || user.avatar, user.id);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        }
        if ((user.status || 'active') === 'locked') return done(null, false, { message: 'Tài khoản đã bị khóa' });
        const { password: _, ...safe } = user;
        done(null, safe);
      }
    )
  );
}

if (process.env.FACEBOOK_APP_ID) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ['id', 'displayName', 'emails', 'photos'],
      },
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value;
        let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
          const r = db.prepare(`
            INSERT INTO users (email, name, avatar, provider, provider_id) VALUES (?, ?, ?, 'facebook', ?)
          `).run(email || '', profile.displayName || 'User', profile.photos?.[0]?.value || DEFAULT_AVATAR_URL, profile.id);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
        } else if (!user.provider) {
          db.prepare('UPDATE users SET provider = ?, provider_id = ?, avatar = ? WHERE id = ?').run('facebook', profile.id, profile.photos?.[0]?.value || user.avatar, user.id);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        }
        if ((user.status || 'active') === 'locked') return done(null, false, { message: 'Tài khoản đã bị khóa' });
        const { password: _, ...safe } = user;
        done(null, safe);
      }
    )
  );
}

export default passport;
