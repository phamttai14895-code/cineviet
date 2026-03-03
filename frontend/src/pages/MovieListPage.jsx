import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { movies as moviesApi } from '../api/client';
import MovieCard from '../components/MovieCard';
import TrendingBlock from '../components/TrendingBlock.jsx';
import { usePublicSettings } from '../context/PublicSettingsContext';
import { useSeo } from '../hooks/useSeo.js';

const LIMIT_FALLBACK = 20;
const CATEGORIES_GRID_6 = ['phim-moi', 'phim-bo', 'phim-le', 'tv-shows', 'anime'];
const SORT_OPTIONS = [
  { value: 'created_at', order: 'desc', label: 'Mới nhất' },
  { value: 'view_count', order: 'desc', label: 'Xem nhiều' },
  { value: 'rating', order: 'desc', label: 'Đánh giá cao' },
  { value: 'release_year', order: 'desc', label: 'Năm mới' },
  { value: 'title', order: 'asc', label: 'A-Z' },
];

const CATEGORY_CONFIG = {
  'phim-moi': {
    title: 'Tất Cả Phim Mới',
    subtitle: 'Còn chờ gì mà không xem ngay!',
    getParams: () => ({}),
  },
  'phim-bo': {
    title: 'Tất Cả Phim Bộ',
    subtitle: 'Theo dõi từng tập, nghiện từng giây - phim bộ hay đang chờ bạn!',
    getParams: () => ({ type: 'series' }),
  },
  'phim-le': {
    title: 'Tất Cả Phim Lẻ',
    subtitle: 'Ngồi xuống, bắp rang sẵn rồi - chọn phim lẻ hay và chill thôi nào!',
    getParams: () => ({ type: 'movie' }),
  },
  anime: {
    title: 'Tất Cả Anime',
    subtitle: 'Thế giới Anime đầy màu sắc cho mọi lứa tuổi.',
    getParams: () => ({ type: 'anime' }),
  },
  'tv-shows': {
    title: 'Tất Cả TV Shows',
    subtitle: 'Các chương trình truyền hình thực tế, gameshow hấp dẫn màn ảnh nhỏ.',
    getParams: () => ({ type: 'tvshows' }),
  },
  'xem-chung': {
    title: 'Xem cùng bạn bè',
    subtitle: 'Cùng thưởng thức các bộ phim hay cùng với bạn bè nào!.',
    getParams: () => ({ sort: 'view_count', order: 'desc' }),
  },
};

const TRENDING_CONFIG = {
  'phim-moi': {
    title: 'Phim Mới Thịnh Hành',
    subtitle: 'Được xem nhiều nhất tuần này',
    listParams: {},
  },
  'phim-bo': {
    title: 'Phim Bộ Thịnh Hành',
    subtitle: 'Được xem nhiều nhất tuần này',
    listParams: { type: 'series' },
  },
  'phim-le': {
    title: 'Phim Lẻ Thịnh Hành',
    subtitle: 'Được xem nhiều nhất tuần này',
    listParams: { type: 'movie' },
  },
  anime: {
    title: 'Anime Thịnh Hành',
    subtitle: 'Được xem nhiều nhất tuần này',
    listParams: { type: 'anime' },
  },
  'tv-shows': {
    title: 'TV Shows Thịnh Hành',
    subtitle: 'Được xem nhiều nhất tuần này',
    listParams: { type: 'tvshows' },
  },
};

export default function MovieListPage({ category }) {
  const config = CATEGORY_CONFIG[category];
  const settings = usePublicSettings();
  const limit = Math.min(100, Math.max(1, settings?.movies_per_page ?? LIMIT_FALLBACK));
  useSeo(config?.title, config?.subtitle);
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
  const useGrid6 = CATEGORIES_GRID_6.includes(category);

  const [data, setData] = useState({ movies: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) return;
    setLoading(true);
    const baseParams = config.getParams();
    const params = {
      ...baseParams,
      page,
      limit,
      sort: sort || 'created_at',
      order: order === 'asc' ? 'asc' : 'desc',
    };
    if (category === 'phim-moi') {
      params.sort = sort || 'created_at';
      params.order = order || 'desc';
    }
    if (category === 'xem-chung') {
      params.sort = sort || 'view_count';
      params.order = order || 'desc';
    }
    moviesApi
      .list(params)
      .then((r) => setData({ movies: r.data.movies || [], total: r.data.total || 0 }))
      .catch(() => setData({ movies: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [category, sort, order, page, limit]);

  const updateParams = (next) => {
    const cur = Object.fromEntries(searchParams.entries());
    setSearchParams({ ...cur, ...next });
  };

  if (!config) {
    return (
      <div className="container">
        <p>Trang không tồn tại.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / limit) || 1;

  return (
    <div className="page-browse page-movie-list">
      <div className="container">
        {TRENDING_CONFIG[category] && <TrendingBlock {...TRENDING_CONFIG[category]} />}
        <div className="browse-header">
          <h1 className="browse-title">{config.title}</h1>
          <p className="browse-subtitle">{config.subtitle}</p>
          {data.total > 0 && (
            <p className="browse-meta">{data.total} Phim</p>
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
            <div className={`movie-grid browse-grid${useGrid6 ? ' browse-grid-6' : ''}`}>
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
