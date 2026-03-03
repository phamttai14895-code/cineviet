import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { movies as moviesApi } from '../api/client';
import { slugify } from '../utils/slugify.js';

export default function QuocGia() {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    moviesApi
      .countries()
      .then((r) => setCountries(r.data || []))
      .catch(() => setCountries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-quoc-gia">
      <div className="container">
        <div className="page-section-header">
          <h1 className="page-title">Quốc gia</h1>
          <p className="page-subtitle">Chọn quốc gia để xem danh sách phim.</p>
        </div>

        {loading ? (
          <div className="loading-wrap">Đang tải...</div>
        ) : (
          <div className="country-grid">
            {countries.map((c) => {
              const name = typeof c === 'object' ? c.name : c;
              const id = typeof c === 'object' ? c.id : c;
              const slug = (typeof c === 'object' && c.slug) ? c.slug : slugify(name);
              return (
                <Link
                  key={id}
                  to={`/quoc-gia/${slug}`}
                  className="country-card"
                >
                  <span className="country-card-icon">🌐</span>
                  <span className="country-card-name">{name}</span>
                  <i className="fas fa-chevron-right country-card-arrow" />
                </Link>
              );
            })}
          </div>
        )}

        {!loading && countries.length === 0 && (
          <p className="page-empty">Chưa có quốc gia nào.</p>
        )}
      </div>
    </div>
  );
}
