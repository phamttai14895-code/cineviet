import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';

const TYPE_OPTIONS = [
  { value: 'movie', label: 'Phim lẻ' },
  { value: 'series', label: 'Phim bộ' },
  { value: 'anime', label: 'Anime' },
];

const COUNTRY_OPTIONS = ['Mỹ', 'Nhật Bản', 'Hàn Quốc', 'Trung Quốc', 'Việt Nam', 'Thái Lan', 'Anh', 'Ấn Độ', 'Khác'];

const QUALITY_OPTIONS = ['HD', 'FHD', '2K', '4K', 'SD'];

const LANGUAGE_OPTIONS = ['Vietsub', 'Thuyết minh', 'Song ngữ', 'Nguyên bản'];

export default function AdminEditMovie() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [genres, setGenres] = useState([]);
  const [form, setForm] = useState(null);
  const [genreIds, setGenreIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([admin.getMovie(id), admin.genres()])
      .then(([movieRes, genresRes]) => {
        const m = movieRes.data;
        setGenres(genresRes.data);
        setForm({
          title: m.title || '',
          title_en: m.title_en || '',
          slug: m.slug || '',
          type: m.type || 'movie',
          release_year: m.release_year ? String(m.release_year) : '',
          country: m.country || 'Mỹ',
          quality: m.quality || 'HD',
          language: m.language || 'Vietsub',
          poster_url: m.poster || '',
          backdrop_url: m.backdrop || '',
          trailer_url: m.trailer_url || '',
          video_url: m.video_url || '',
          subtitle_url: m.subtitle_url || '',
          total_episodes: m.total_episodes || 0,
          description: m.description || '',
          status: m.status || 'published',
          featured: m.featured === 1 || m.featured === true,
        });
        setGenreIds(Array.isArray(m.genre_ids) ? m.genre_ids : []);
      })
      .catch((err) => setError(err.response?.data?.error || 'Không tải được phim'))
      .finally(() => setLoading(false));
  }, [id]);

  const update = (key, value) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const toggleGenre = (gid) => {
    setGenreIds((prev) => (prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form) return;
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
    fd.append('backdrop_url', form.backdrop_url);
    fd.append('trailer_url', form.trailer_url);
    fd.append('video_url', form.video_url);
    fd.append('subtitle_url', form.subtitle_url || '');
    fd.append('total_episodes', String(form.total_episodes));
    fd.append('description', form.description);
    fd.append('status', form.status);
    fd.append('featured', form.featured ? '1' : '0');
    fd.append('genre_ids', JSON.stringify(genreIds));
    try {
      await admin.updateMovie(id, fd);
      toast.success('Đã lưu phim.');
      navigate('/admin/movies');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Có lỗi khi lưu phim');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="admin-add-movie-page"><div className="admin-add-movie-header"><h1>Sửa phim</h1></div><p>Đang tải...</p></div>;
  if (error) return <div className="admin-add-movie-page"><div className="admin-add-movie-header"><h1>Sửa phim</h1></div><p>{error}</p><Link to="/admin/movies" className="btn btn-ghost">Quay lại</Link></div>;
  if (!form) return null;

  return (
    <div className="admin-add-movie-page">
      <div className="admin-add-movie-header">
        <h1 className="admin-add-movie-title with-bar">Sửa phim</h1>
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
            NĂM SẢN XUẤT
            <input
              type="number"
              value={form.release_year}
              onChange={(e) => update('release_year', e.target.value)}
              min="1900"
              max="2030"
              placeholder="Để trống nếu chưa rõ"
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
            BACKDROP URL
            <input
              type="url"
              value={form.backdrop_url}
              onChange={(e) => update('backdrop_url', e.target.value)}
              placeholder="https://..."
            />
          </label>
        </div>

        <div className="admin-add-movie-row">
          <label className="admin-add-movie-label">
            TRAILER YOUTUBE URL
            <input
              type="url"
              value={form.trailer_url}
              onChange={(e) => update('trailer_url', e.target.value)}
              placeholder="https://youtube.com/..."
            />
          </label>
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
            PHỤ ĐỀ (VTT)
            <input
              type="url"
              value={form.subtitle_url}
              onChange={(e) => update('subtitle_url', e.target.value)}
              placeholder="https://...vtt hoặc /uploads/..."
            />
          </label>
        </div>

        <div className="admin-add-movie-row">
          <label className="admin-add-movie-label">
            TỔNG SỐ TẬP (PHIM BỘ)
            <input
              type="number"
              value={form.total_episodes}
              onChange={(e) => update('total_episodes', e.target.value)}
              min="0"
            />
          </label>
          <label className="admin-add-movie-label">
            TRẠNG THÁI
            <select value={form.status} onChange={(e) => update('status', e.target.value)}>
              <option value="published">Hiển thị</option>
              <option value="pending">Chờ duyệt</option>
            </select>
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
            Lưu thay đổi
          </button>
          <Link to="/admin/movies" className="btn btn-ghost">Hủy</Link>
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
