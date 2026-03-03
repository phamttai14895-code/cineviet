/**
 * Slug hóa chuỗi (bỏ dấu, lowercase, nối bằng -).
 * Dùng thống nhất cho link diễn viên, v.v. để URL chuẩn SEO.
 */
export function slugify(s) {
  if (s == null || typeof s !== 'string') return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || s.trim().toLowerCase().replace(/\s+/g, '-');
}
