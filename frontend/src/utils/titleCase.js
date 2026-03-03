/**
 * Viết hoa chữ cái đầu mỗi từ cho tên phim (và chuỗi hiển thị).
 * Ví dụ: "PHIM HAY NHẤT" → "Phim Hay Nhất", "one piece" → "One Piece"
 */
export function toTitleCase(str) {
  if (str == null || typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (!word.length) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
