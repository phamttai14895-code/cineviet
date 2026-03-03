/**
 * Slug hóa chuỗi (tên diễn viên, đạo diễn, ...) giống frontend.
 * Dùng NFD + bỏ dấu để "Hồng Cnh Dư" → "hong-cnh-du" (khớp link từ trang phim).
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

/**
 * Từ slug phim dạng "ten-phim-phan-1" hoặc "ten-phim-part-2" trả về { series_key, part_number }.
 * Dùng để gộp phim nhiều phần: cùng series_key → API trả về movie.parts → trang xem có dropdown chọn phần.
 * Slug nên kết thúc bằng -phan-N hoặc -part-N (vd: vo-si-thanh-dat-phan-1, vo-si-thanh-dat-part-2).
 */
export function parseSeriesFromSlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  const s = slug.trim();
  const match = s.match(/-phan-(\d+)$/i) || s.match(/-part-(\d+)$/i);
  if (!match) return null;
  const partNumber = Math.max(1, parseInt(match[1], 10) || 1);
  const seriesKey = s.slice(0, -match[0].length);
  if (!seriesKey) return null;
  return { series_key: seriesKey, part_number: partNumber };
}
