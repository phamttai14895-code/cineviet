/**
 * Avatar ngẫu nhiên — danh sách ảnh đại diện có sẵn (pravatar placeholder).
 * Pravatar.cc chỉ có id 1–70, id > 70 sẽ lỗi.
 */
const PRAVATAR = 'https://i.pravatar.cc/150';

const COUNT = 70;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const PRESET_AVATARS = shuffle(
  Array.from({ length: COUNT }, (_, i) => `${PRAVATAR}?img=${i + 1}`)
);
