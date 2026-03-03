import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { movies as moviesApi } from '../api/client';
import MovieCard from '../components/MovieCard';
import { slugify } from '../utils/slugify.js';
import { useBreadcrumb } from '../context/BreadcrumbContext';
import { usePublicSettings } from '../context/PublicSettingsContext';
import { useSeo } from '../hooks/useSeo.js';

const LIMIT_FALLBACK = 20;
const SORT_OPTIONS = [
  { value: 'created_at', order: 'desc', label: 'Mới nhất' },
  { value: 'view_count', order: 'desc', label: 'Xem nhiều' },
  { value: 'rating', order: 'desc', label: 'Đánh giá cao' },
  { value: 'release_year', order: 'desc', label: 'Năm mới' },
  { value: 'title', order: 'asc', label: 'A-Z' },
];

/** Trang danh sách phim theo thể loại / quốc gia / năm. filterType: 'genre' | 'country' | 'year'; paramKey: tên param trong URL (id | country | year). URL quốc gia dùng slug không dấu (vd: hong-kong). */
export default function FilteredMovieListPage({ filterType, paramKey }) {
  const params = useParams();
  let value = params[paramKey];
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);

  const settings = usePublicSettings();
  const siteName = (settings?.site_name || '').trim() || 'CineViet';
  const limit = Math.min(100, Math.max(1, settings?.movies_per_page ?? LIMIT_FALLBACK));
  const [title, setTitle] = useState('');
  const [data, setData] = useState({ movies: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const { setBreadcrumbItems } = useBreadcrumb();

  // Redirect quốc gia: URL có dấu hoặc space -> chuyển sang slug chuẩn (vd: Hồng Kông -> hong-kong)
  useEffect(() => {
    if (filterType !== 'country' || !value) return;
    try {
      const decoded = decodeURIComponent(value);
      const canonical = slugify(decoded);
      if (canonical && canonical !== value) {
        navigate(`/quoc-gia/${canonical}${window.location.search || ''}`, { replace: true });
      }
    } catch (_) {}
  }, [filterType, value, navigate]);

  useEffect(() => {
    if (!value) return;
    setLoading(true);
    const apiParams = {
      page,
      limit,
      sort: sort || 'created_at',
      order: order === 'asc' ? 'asc' : 'desc',
    };
    if (filterType === 'genre') {
      apiParams.genre = value;
    } else if (filterType === 'country') {
      apiParams.country = value;
    } else if (filterType === 'year') {
      apiParams.release_year = value;
    }

    const fetchTitle = () => {
      if (filterType === 'genre') {
        return moviesApi.genres().then((r) => {
          const g = (r.data || []).find((x) => String(x.id) === String(value));
          return g ? g.name : `Thể loại #${value}`;
        }).catch(() => `Thể loại #${value}`);
      }
      if (filterType === 'country') {
        return moviesApi.countries().then((r) => {
          const list = r.data || [];
          const bySlug = list.find((c) => (c.slug || slugify(c.name)) === value);
          return bySlug ? bySlug.name : value;
        }).catch(() => value);
      }
      if (filterType === 'year') {
        return Promise.resolve(`Phim năm ${value}`);
      }
      return Promise.resolve('');
    };

    fetchTitle().then(setTitle);

    moviesApi
      .list(apiParams)
      .then((r) => {
        setData({ movies: r.data.movies || [], total: r.data.total || 0 });
        if (filterType === 'country' && r.data?.resolved_country) setTitle(r.data.resolved_country);
      })
      .catch(() => setData({ movies: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [filterType, paramKey, value, sort, order, page, limit]);

  useEffect(() => {
    if (!title) return;
    const parentLabel = filterType === 'genre' ? 'Thể loại' : filterType === 'country' ? 'Quốc gia' : 'Năm';
    const parentPath = filterType === 'genre' ? '/the-loai' : filterType === 'country' ? '/quoc-gia' : '/nam';
    setBreadcrumbItems([{ label: 'Trang chủ', to: '/' }, { label: parentLabel, to: parentPath }, { label: title }]);
    return () => setBreadcrumbItems([]);
  }, [filterType, title, setBreadcrumbItems]);

  const seoTitle = value
    ? (title || (filterType === 'year' ? `Phim năm ${value}` : filterType === 'country' ? value : `Thể loại #${value}`))
    : '';
  const seoDescription = useMemo(() => {
    if (!value || !seoTitle) return undefined;
    if (filterType === 'genre') return `Danh sách phim thể loại ${seoTitle}. Xem online miễn phí tại ${siteName}.`;
    if (filterType === 'country') return `Danh sách phim quốc gia ${seoTitle}. Xem online miễn phí tại ${siteName}.`;
    if (filterType === 'year') return `Phim phát hành năm ${value}. Xem online miễn phí tại ${siteName}.`;
    return undefined;
  }, [filterType, value, seoTitle, siteName]);
  useSeo(seoTitle || undefined, seoDescription);

  const updateParams = (next) => {
    const cur = Object.fromEntries(searchParams.entries());
    setSearchParams({ ...cur, ...next });
  };

  if (!value) {
    return (
      <div className="container">
        <p>Thiếu tham số.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / limit) || 1;
  const displayTitle = title || (filterType === 'year' ? `Phim năm ${value}` : filterType === 'country' ? value : '');
  const subtitle = filterType === 'genre'
    ? `Danh sách phim thể loại ${displayTitle}.`
    : filterType === 'country'
      ? `Danh sách phim quốc gia ${displayTitle}.`
      : `Phim phát hành năm ${value}.`;

  return (
    <div className="page-browse page-movie-list">
      <div className="container">
        <div className="browse-header">
          <h1 className="browse-title">{displayTitle}</h1>
          <p className="browse-subtitle">{subtitle}</p>
          {data.total > 0 && (
            <p className="browse-meta">{data.total} phim</p>
          )}
        </div>

        <div className="browse-toolbar">
          <div className="browse-filters">
            <select
              className="browse-select"
              value={`${sort}_${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split('_');
                updateParams({ sort: s, order: o, page: '1' });
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={`${opt.value}_${opt.order}`} value={`${opt.value}_${opt.order}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-wrap">Đang tải...</div>
        ) : data.movies.length === 0 ? (
          <div className="browse-empty">
            <p>Chưa có phim nào.</p>
            <a href="/">Xem tất cả phim</a>
          </div>
        ) : (
          <>
            <div className="movie-grid browse-grid browse-grid-6">
              {data.movies.map((m) => (
                <MovieCard key={m.id} movie={m} showBadges />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: String(page - 1) })}
                >
                  Trước
                </button>
                <span className="pagination-info">
                  Trang {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page >= totalPages}
                  onClick={() => updateParams({ page: String(page + 1) })}
                >
                  Sau
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
