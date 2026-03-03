import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { actors as actorsApi } from '../api/client';
import { imageDisplayUrl } from '../utils/imageUrl.js';

const PER_PAGE = 30;

export default function Actors() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchActors = useCallback(() => {
    setLoading(true);
    const params = { page, limit: PER_PAGE };
    if (search.trim()) params.search = search.trim();
    actorsApi
      .list(params)
      .then((r) => {
        const data = r.data || {};
        setList(data.actors || []);
        setTotal(data.total != null ? data.total : 0);
      })
      .catch(() => {
        setList([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    fetchActors();
  }, [fetchActors]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="actors-page">
      <div className="container actors-page-inner">
        <h1 className="actors-page-title">Diễn viên</h1>
        <div className="actors-search-wrap">
          <label htmlFor="actors-search" className="actors-search-label">
            Tìm theo tên tiếng Việt hoặc tên tiếng Anh
          </label>
          <input
            id="actors-search"
            type="search"
            className="actors-search-input"
            placeholder="Tìm diễn viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm diễn viên"
          />
        </div>
        {loading ? (
          <div className="actors-loading">Đang tải...</div>
        ) : list.length === 0 ? (
          <p className="actors-empty">Chưa có diễn viên nào.</p>
        ) : (
          <>
            <div className="actors-grid">
              {list.map((actor) => (
                <Link
                  key={actor.id}
                  to={`/dien-vien/${actor.slug}`}
                  className="actor-card"
                >
                  <div className="actor-card-image-wrap">
                    {actor.avatar ? (
                      <img src={imageDisplayUrl(actor.avatar)} alt="" className="actor-card-img" />
                    ) : (
                      <span className="actor-card-avatar" aria-hidden>
                        {actor.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <span className="actor-card-name">{actor.name}</span>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="actors-pagination">
                <span className="actors-pagination-info">
                  {`Trang ${page} / ${totalPages} — ${total} diễn viên`}
                </span>
                <div className="actors-pagination-btns">
                  <button
                    type="button"
                    className="btn btn-ghost actors-page-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Trang trước"
                  >
                    <i className="fas fa-chevron-left" />
                  </button>
                  <span className="actors-page-num">{page}</span>
                  <button
                    type="button"
                    className="btn btn-ghost actors-page-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Trang sau"
                  >
                    <i className="fas fa-chevron-right" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
