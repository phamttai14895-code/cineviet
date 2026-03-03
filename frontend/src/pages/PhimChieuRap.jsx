import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { movies as moviesApi } from '../api/client';
import MovieCard from '../components/MovieCard';
import TrendingBlock from '../components/TrendingBlock.jsx';
import { usePublicSettings } from '../context/PublicSettingsContext';

const LIMIT_FALLBACK = 20;
const SORT_OPTIONS = [
  { value: 'created_at', order: 'desc', label: 'Mới nhất' },
  { value: 'view_count', order: 'desc', label: 'Xem nhiều' },
  { value: 'rating', order: 'desc', label: 'Đánh giá cao' },
  { value: 'release_year', order: 'desc', label: 'Năm mới' },
  { value: 'title', order: 'asc', label: 'A-Z' },
];

export default function PhimChieuRap() {
  const settings = usePublicSettings();
  const limit = Math.min(100, Math.max(1, settings?.movies_per_page ?? LIMIT_FALLBACK));
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);

  const [data, setData] = useState({ movies: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = {
      chieu_rap: 1,
      page,
      limit,
      sort: sort || 'created_at',
      order: order === 'asc' ? 'asc' : 'desc',
    };
    moviesApi
      .list(params)
      .then((r) => setData({ movies: r.data.movies || [], total: r.data.total || 0 }))
      .catch(() => setData({ movies: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [sort, order, page, limit]);

  const updateParams = (next) => {
    const cur = Object.fromEntries(searchParams.entries());
    setSearchParams({ ...cur, ...next });
  };

  const totalPages = Math.ceil(data.total / limit) || 1;

  return (
    <div className="page-browse page-phim-chieu-rap">
      <div className="container">
        <TrendingBlock
          title="Phim Chiếu Rạp Thịnh Hành"
          subtitle="Được xem nhiều nhất tuần này"
          listParams={{ chieu_rap: 1 }}
        />
        <div className="browse-header">
          <h1 className="browse-title">Tất Cả Phim Chiếu Rạp</h1>
          <p className="browse-subtitle">Các phim đang hoặc đã chiếu rạp từ nguồn Ophim, PhimAPI, Nguonc.</p>
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
            <p>Chưa có phim chiếu rạp nào. Phim chiếu rạp được lấy từ nguồn có trường &quot;chieurap&quot;: true.</p>
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
