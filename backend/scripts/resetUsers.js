/**
 * Xóa toàn bộ user (và dữ liệu liên quan) rồi tạo lại 1 tài khoản admin mặc định.
 * Chạy: node scripts/resetUsers.js (từ thư mục backend)
 *
 * Tài khoản admin mới:
 *   Email: admin@phim.local
 *   Mật khẩu: admin123
 *
 * Có thể đổi email/mật khẩu bằng biến môi trường:
 *   ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpass node scripts/resetUsers.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
const dbPath = path.join(dataDir, 'phim.db');

if (!fs.existsSync(dbPath)) {
  console.error('Không tìm thấy database:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

// Thứ tự xóa: bảng phụ thuộc user_id trước, cuối cùng mới xóa users
const tablesToClear = [
  'comment_reports',  // user_id, comment_id
  'watch_reports',    // user_id (có thể SET NULL nhưng xóa sạch cho đơn giản)
  'login_log',        // user_id (có thể chưa có bảng)
  'user_ratings',
  'user_favorites',
  'watch_history',
  'comments',
];

function tableExists(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  return !!row;
}

console.log('Đang xóa toàn bộ user và dữ liệu liên quan...');

for (const table of tablesToClear) {
  if (tableExists(table)) {
    const info = db.prepare(`DELETE FROM ${table}`).run();
    if (info.changes > 0) console.log(`  - ${table}: đã xóa ${info.changes} dòng`);
  }
}

const userDeleted = db.prepare('DELETE FROM users').run();
console.log(`  - users: đã xóa ${userDeleted.changes} tài khoản`);

// Tạo lại 1 admin mặc định
const adminEmail = process.env.ADMIN_EMAIL || 'admin@phim.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

const bcrypt = await import('bcryptjs');
const hash = bcrypt.default.hashSync(adminPassword, 10);

db.prepare(`
  INSERT INTO users (email, password, name, role, status) VALUES (?, ?, 'Admin', 'admin', 'active')
`).run(adminEmail, hash);

console.log('');
console.log('Đã tạo tài khoản admin mới:');
console.log('  Email:', adminEmail);
console.log('  Mật khẩu:', adminPassword);
console.log('');
console.log('Đăng nhập trang admin bằng tài khoản trên, sau đó có thể đổi mật khẩu trong profile.');

db.close();
