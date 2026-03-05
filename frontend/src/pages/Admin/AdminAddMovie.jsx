import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { admin } from '../../api/client';
import { slugify } from '../../utils/slugify.js';
import { useToast } from '../../context/ToastContext';

const TYPE_OPTIONS = [
  { value: 'movie', label: 'Phim lẻ' },
  { value: 'series', label: 'Phim bộ' },
  { value: 'anime', label: 'Anime' },
];

const COUNTRY_OPTIONS = ['Mỹ', 'Nhật Bản', 'Hàn Quốc', 'Trung Quốc', 'Việt Nam', 'Thái Lan', 'Anh', 'Ấn Độ', 'Khác'];

const QUALITY_OPTIONS = ['HD', 'FHD', '2K', '4K', 'SD'];

const LANGUAGE_OPTIONS = ['Vietsub', 'Thuyết minh', 'Song ngữ', 'Nguyên bản'];

const initialForm = {
  title: '',
  title_en: '',
  slug: '',
  type: 'movie',
  release_year: '2024',
  country: 'Mỹ',
  quality: 'HD',
  language: 'Vietsub',
  poster_url: '',
  trailer_url: '',
  video_url: '',
  total_episodes: 0,
  description: '',
  featured: false,
};

export default function AdminAddMovie() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [genres, setGenres] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [genreIds, setGenreIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    admin.genres().then((r) => setGenres(r.data)).catch(() => {});
  }, []);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleGenre = (id) => {
    setGenreIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleReset = () => {
    setForm(initialForm);
    setGenreIds([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('title_en', form.title_en);
    fd.append('slug', (form.slug || '').trim());
    fd.append('type', form.type);
    fd.append('release_year', form.release_year);
    fd.append('country', form.country);
    fd.append('quality', form.quality);
    fd.append('language', form.language);
    fd.append('poster_url', form.poster_url);
    fd.append('trailer_url', form.trailer_url);
    fd.append('video_url', form.video_url);
    fd.append('total_episodes', String(form.total_episodes));
    fd.append('description', form.description);
    fd.append('featured', form.featured ? '1' : '0');
    fd.append('genre_ids', JSON.stringify(genreIds));
    try {
      await admin.createMovie(fd);
      toast.success('Đã thêm phim.');
      navigate('/admin/movies');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Có lỗi khi lưu phim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-add-movie-page">
      <div className="admin-add-movie-header">
        <h1 className="admin-add-movie-title with-bar">Thêm phim mới</h1>
        <Link to="/admin/movies" className="btn btn-ghost">
          Quay lại
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="admin-add-movie-form">
        <div className="admin-add-movie-row">
          <label className="admin-add-movie-label">
            TÊN PHIM (TIẾNG VIỆT) *
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="VD: Dune: Phần Hai"
              required
            />
          </label>
          <label className="admin-add-movie-label">
            TÊN TIẾNG ANH
            <input
              type="text"
              value={form.title_en}
              onChange={(e) => update('title_en', e.target.value)}
              placeholder="VD: Dune: Part Two"
            />
          </label>
        </div>

        <div className="admin-add-movie-row">
          <label className="admin-add-movie-label">
            SLUG (URL) *
            <input
              type="text"
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              placeholder="VD: dune-part-two"
            />
          </label>
          <label className="admin-add-movie-label">
            LOẠI PHIM *
            <select value={form.type} onChange={(e) => update('type', e.target.value)}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-add-movie-row">
          <label className="admin-add-movie-label">
            NĂM SẢN XUẤT *
            <input
              type="number"
              value={form.release_year}
              onChange={(e) => update('release_year', e.target.value)}
              min="1900"
              max="2030"
              required
            />
          </label>
          <label className="admin-add-movie-label">
            QUỐC GIA
            <select value={form.country} onChange={(e) => update('country', e.target.value)}>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-add-movie-row">
          <label className="admin-add-movie-label">
            CHẤT LƯỢNG
            <select value={form.quality} onChange={(e) => update('quality', e.target.value)}>
              {QUALITY_OPTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </label>
          <label className="admin-add-movie-label">
            NGÔN NGỮ
            <select value={form.language} onChange={(e) => update('language', e.target.value)}>
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-add-movie-row">
          <label className="admin-add-movie-label">
            POSTER URL
            <input
              type="url"
              value={form.poster_url}
              onChange={(e) => update('poster_url', e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="admin-add-movie-label">
            TRAILER YOUTUBE URL
            <input
              type="url"
              value={form.trailer_url}
              onChange={(e) => update('trailer_url', e.target.value)}
              placeholder="https://youtube.com/..."
            />
          </label>
        </div>

        <div className="admin-add-movie-row">
          <label className="admin-add-movie-label">
            VIDEO URL (M3U8/MP4)
            <input
              type="url"
              value={form.video_url}
              onChange={(e) => update('video_url', e.target.value)}
              placeholder="https://...m3u8"
            />
          </label>
          <label className="admin-add-movie-label">
            TỔNG SỐ TẬP (PHIM BỘ)
            <input
              type="number"
              value={form.total_episodes}
              onChange={(e) => update('total_episodes', e.target.value)}
              min="0"
            />
          </label>
        </div>

        <label className="admin-add-movie-label admin-add-movie-full">
          MÔ TẢ
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Nội dung phim..."
            rows={4}
          />
        </label>

        <div className="admin-add-movie-genres">
          <span className="admin-add-movie-genres-title">Thể loại:</span>
          {genres.map((g) => (
            <label key={g.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={genreIds.includes(g.id)}
                onChange={() => toggleGenre(g.id)}
              />
              {g.name}
            </label>
          ))}
        </div>

        <div className="admin-add-movie-actions">
          <button type="submit" className="btn btn-primary admin-add-movie-save" disabled={submitting}>
            Lưu phim
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleReset}>
            Reset
          </button>
          <label className="admin-add-movie-featured">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => update('featured', e.target.checked)}
            />
            Đặt làm phim nổi bật
          </label>
        </div>
      </form>
    </div>
  );
}
