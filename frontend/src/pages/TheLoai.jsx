import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { movies as moviesApi } from '../api/client';

export default function TheLoai() {
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    moviesApi
      .genres()
      .then((r) => setGenres(r.data || []))
      .catch(() => setGenres([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-the-loai">
      <div className="container">
        <div className="page-section-header">
          <h1 className="page-title">Thể loại phim</h1>
          <p className="page-subtitle">Chọn thể loại để xem danh sách phim tương ứng.</p>
        </div>

        {loading ? (
          <div className="loading-wrap">Đang tải...</div>
        ) : (
          <div className="genre-grid">
            {genres.map((g) => (
              <Link
                key={g.id}
                to={`/the-loai/${g.id}`}
                className="genre-card"
              >
                <span className="genre-card-icon">🎬</span>
                <span className="genre-card-name">{g.name}</span>
                <i className="fas fa-chevron-right genre-card-arrow" />
              </Link>
            ))}
          </div>
        )}

        {!loading && genres.length === 0 && (
          <p className="page-empty">Chưa có thể loại nào.</p>
        )}
      </div>
    </div>
  );
}
