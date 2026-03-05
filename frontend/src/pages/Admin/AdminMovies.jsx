import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api/client';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../../utils/imageUrl.js';
import { toTitleCase } from '../../utils/titleCase.js';
import { useToast } from '../../context/ToastContext';

const TYPE_LABELS = { movie: 'Phim lẻ', series: 'Phim bộ', anime: 'Anime' };
const STATUS_LABELS = { published: 'Hiển thị', pending: 'Chờ duyệt' };
const SOURCE_LABELS = { phimapi: 'KKPhim' };
const POSTER_PLACEHOLDER = NO_POSTER_DATA_URL;

function formatViews(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export default function AdminMovies() {
  const { toast } = useToast();
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const load = () => {
    setLoading(true);
    const params = { page, limit };
    if (search.trim()) params.search = search.trim();
    if (filterType) params.type = filterType;
    if (filterStatus) params.status = filterStatus;
    Promise.all([admin.movies(params), admin.genres()])
      .then(([m, g]) => {
        const data = m.data;
        setMovies(Array.isArray(data.movies) ? data.movies : (data || []));
        setTotal(data.total != null ? data.total : (Array.isArray(data) ? data.length : 0));
        setGenres(g.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const isFirstSearch = useRef(true);

  useEffect(() => {
    load();
  }, [filterType, filterStatus, page, limit]);

  useEffect(() => {
    if (isFirstSearch.current) {
      isFirstSearch.current = false;
      return;
    }
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleDelete = async (id) => {
    if (!confirm('Xóa phim này?')) return;
    try {
      await admin.deleteMovie(id);
      load();
      toast.success('Đã xóa phim.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa');
    }
  };

  const handleToggleHide = async (m) => {
    const nextStatus = (m.status || 'published') === 'published' ? 'pending' : 'published';
    try {
      await admin.updateMovieStatus(m.id, nextStatus);
      load();
      toast.success('Đã đổi trạng thái.');
    } catch (e) {
      toast.error('Không thể đổi trạng thái');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= movies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(movies.map((m) => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('Chọn ít nhất một phim để xóa.');
      return;
    }
    if (!confirm(`Xóa ${selectedIds.size} phim đã chọn?`)) return;
    try {
      await admin.deleteMoviesBulk([...selectedIds]);
      setSelectedIds(new Set());
      load();
      toast.success(`Đã xóa ${selectedIds.size} phim.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa');
    }
  };

  const handleDeleteAll = async () => {
    const confirmText = 'XÓA TẤT CẢ';
    const entered = prompt(`Bạn sẽ xóa toàn bộ phim (${total} phim), bình luận, lịch sử xem và yêu thích liên quan. Nhập "${confirmText}" để xác nhận:`);
    if (entered !== confirmText) {
      if (entered != null) toast.error('Xác nhận không đúng. Đã hủy.');
      return;
    }
    try {
      const res = await admin.deleteAllMovies();
      setSelectedIds(new Set());
      load();
      toast.success(res?.data?.message || `Đã xóa ${res?.data?.deleted ?? 0} phim.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa toàn bộ phim');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const maxViews = Math.max(1, ...movies.map((m) => m.view_count || 0));

  return (
    <div className="admin-movies-page">
      <div className="admin-movies-header">
        <h1 className="admin-movies-title with-bar">Quản lý phim</h1>
        <div className="admin-movies-toolbar">
          <input
            type="search"
            placeholder="Tìm phim..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-movies-search"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="admin-movies-filter"
            aria-label="Lọc loại"
          >
            <option value="">Tất cả</option>
            <option value="movie">Phim lẻ</option>
            <option value="series">Phim bộ</option>
            <option value="anime">Anime</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="admin-movies-filter"
            aria-label="Lọc trạng thái"
          >
            <option value="">Tất cả</option>
            <option value="published">Hiển thị</option>
            <option value="pending">Chờ duyệt</option>
          </select>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="admin-movies-filter"
            aria-label="Số phim mỗi trang"
          >
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
            <option value={50}>50 / trang</option>
            <option value={100}>100 / trang</option>
          </select>
          {selectedIds.size > 0 && (
            <button type="button" className="btn btn-danger admin-movies-add" onClick={handleBulkDelete}>
              <i className="fas fa-trash" /> Xóa đã chọn ({selectedIds.size})
            </button>
          )}
          <button type="button" className="btn btn-danger admin-movies-add" onClick={handleDeleteAll} title="Xóa toàn bộ phim trong hệ thống">
            <i className="fas fa-trash-alt" /> Xóa toàn bộ phim
          </button>
          <Link to="/admin/crawl" className="btn admin-movies-add admin-movies-crawl-btn">
            <i className="fas fa-cloud-download-alt" /> Crawl phim
          </Link>
          <Link to="/admin/movies/add" className="btn btn-primary admin-movies-add">
            <i className="fas fa-plus" /> Thêm
          </Link>
        </div>
      </div>

      <div className="admin-movies-table-wrap">
        {loading ? (
          <p className="loading-wrap">Đang tải...</p>
        ) : (
          <table className="admin-movies-table">
            <thead>
              <tr>
                <th className="admin-movies-th-checkbox">
                  <input
                    type="checkbox"
                    checked={movies.length > 0 && selectedIds.size >= movies.length}
                    onChange={toggleSelectAll}
                    aria-label="Chọn tất cả"
                  />
                </th>
                <th>PHIM</th>
                <th>LOẠI</th>
                <th>NĂM</th>
                <th>RATING</th>
                <th>LƯỢT XEM</th>
                <th>NGUỒN</th>
                <th>TRẠNG THÁI</th>
                <th>HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              {movies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="admin-movies-empty">
                    Không tìm thấy phim nào.
                  </td>
                </tr>
              ) : (
                movies.map((m) => (
                  <tr key={m.id}>
                    <td className="admin-movies-td-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        aria-label={`Chọn ${toTitleCase(m.title)}`}
                      />
                    </td>
                    <td>
                      <div className="admin-movies-cell-movie">
                        <img
                          src={imageDisplayUrl(m.poster) || POSTER_PLACEHOLDER}
                          alt=""
                          className="admin-movies-poster"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { if (e.target.src !== POSTER_PLACEHOLDER) { e.target.onerror = null; e.target.src = POSTER_PLACEHOLDER; } }}
                        />
                        <div>
                          <span className="admin-movies-movie-title">{toTitleCase(m.title)}</span>
                          <span className="admin-movies-movie-meta">{m.country || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{TYPE_LABELS[m.type] || TYPE_LABELS.movie}</td>
                    <td>{m.release_year || '—'}</td>
                    <td>
                      <span className="admin-movies-rating">
                        <i className="fas fa-star" /> {Number(m.rating || 0).toFixed(1)}
                      </span>
                    </td>
                    <td>
                      <div className="admin-movies-views-cell">
                        <span className="admin-movies-views-value">{formatViews(m.view_count || 0)}</span>
                        <div className="admin-movies-views-bar">
                          <div
                            className="admin-movies-views-fill"
                            style={{ width: `${Math.min(100, ((m.view_count || 0) / maxViews) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="admin-movies-source">{m.source ? SOURCE_LABELS[m.source] || m.source : '—'}</span>
                    </td>
                    <td>
                      <span className={`admin-movies-status admin-movies-status-${m.status || 'published'}`}>
                        {STATUS_LABELS[m.status] || STATUS_LABELS.published}
                      </span>
                    </td>
                    <td>
                      <div className="admin-movies-actions-cell">
                        <Link to={`/movie/${m.id}`} target="_blank" rel="noopener noreferrer" className="admin-movies-action-btn" title="Xem">
                          <i className="fas fa-eye" />
                        </Link>
                        <button type="button" className="admin-movies-action-btn" onClick={() => handleToggleHide(m)} title={(m.status || 'published') === 'published' ? 'Ẩn' : 'Hiện'}>
                          <i className={`fas fa-${(m.status || 'published') === 'published' ? 'eye-slash' : 'eye'}`} />
                        </button>
                        <Link to={`/admin/movies/edit/${m.id}`} className="admin-movies-action-btn" aria-label="Sửa" title="Sửa phim">
                          <i className="fas fa-pen" />
                        </Link>
                        <button type="button" className="admin-movies-action-btn btn-danger" onClick={() => handleDelete(m.id)} aria-label="Xóa">
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="admin-movies-pagination">
          <span className="admin-movies-pagination-info">
            Trang {page} / {totalPages} — {total} phim
          </span>
          <div className="admin-movies-pagination-btns">
            <button
              type="button"
              className="btn btn-ghost admin-movies-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Trang trước"
            >
              <i className="fas fa-chevron-left" />
            </button>
            <span className="admin-movies-page-num">{page}</span>
            <button
              type="button"
              className="btn btn-ghost admin-movies-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Trang sau"
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
