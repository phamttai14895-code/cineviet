import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { movies as moviesApi } from '../api/client';
import MovieCard from '../components/MovieCard';
import { usePublicSettings } from '../context/PublicSettingsContext';
import { useSeo } from '../hooks/useSeo.js';

const LIMIT_FALLBACK = 20;

const SORT_OPTIONS = [
  { value: 'created_at', order: 'desc', label: 'Mới nhất' },
  { value: 'view_count', order: 'desc', label: 'Xem nhiều' },
  { value: 'rating', order: 'desc', label: 'Đánh giá cao' },
  { value: 'release_year', order: 'desc', label: 'Năm (mới nhất)' },
  { value: 'title', order: 'asc', label: 'A-Z' },
];

/** Trang kết quả tìm kiếm: ?q= — tìm theo tên phim (VN, EN), diễn viên. */
export default function SearchPage() {
  const settings = usePublicSettings();
  const limit = Math.min(100, Math.max(1, settings?.movies_per_page ?? LIMIT_FALLBACK));
  const [searchParams, setSearchParams] = useSearchParams();
  const q = (searchParams.get('q') || '').trim();
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);

  useSeo(q ? `Tìm kiếm: "${q}"` : 'Tìm kiếm phim', q ? `Kết quả tìm kiếm "${q}" - phim, diễn viên.` : undefined);

  const [data, setData] = useState({ movies: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) {
      setData({ movies: [], total: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    moviesApi
      .list({
        search: q,
        page,
        limit,
        sort: sort || 'created_at',
        order: order === 'asc' ? 'asc' : 'desc',
      })
      .then((r) => setData({ movies: r.data.movies || [], total: r.data.total || 0 }))
      .catch(() => setData({ movies: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [q, sort, order, page, limit]);

  const updateParams = (next) => {
    const cur = Object.fromEntries(searchParams.entries());
    setSearchParams({ ...cur, ...next });
  };

  const totalPages = Math.ceil(data.total / limit) || 1;

  return (
    <div className="page-browse page-movie-list page-search">
      <div className="container">
        <div className="browse-header">
          <h1 className="browse-title">
            {q ? `Tìm kiếm: "${q}"` : 'Tìm kiếm phim'}
          </h1>
          <p className="browse-subtitle">
            {q ? 'Tìm theo tên phim tiếng Việt, tên tiếng Anh, hoặc tên diễn viên.' : 'Nhập từ khóa vào ô tìm kiếm trên đầu trang.'}
          </p>
          {data.total > 0 && <p className="browse-meta">{data.total} phim</p>}
        </div>

        {!q ? null : (
          <>
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
              <p className="empty-msg">Không tìm thấy phim nào. Thử từ khóa khác hoặc tìm theo diễn viên.</p>
            ) : (
              <>
                <div className="movie-grid browse-grid browse-grid-6">
                  {data.movies.map((m) => (
                    <MovieCard key={m.id} movie={m} showBadges />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="browse-pagination">
                    <button
                      type="button"
                      className="browse-pagination-btn"
                      disabled={page <= 1}
                      onClick={() => updateParams({ page: String(page - 1) })}
                    >
                      Trước
                    </button>
                    <span className="browse-pagination-info">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="browse-pagination-btn"
                      disabled={page >= totalPages}
                      onClick={() => updateParams({ page: String(page + 1) })}
                    >
                      Sau
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
