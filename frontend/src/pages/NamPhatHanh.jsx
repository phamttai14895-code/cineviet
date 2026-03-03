import { Link } from 'react-router-dom';

const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = 1990;
const YEARS = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);

export default function NamPhatHanh() {
  return (
    <div className="page-nam-phat-hanh">
      <div className="container">
        <div className="page-section-header">
          <h1 className="page-title">Năm phát hành</h1>
          <p className="page-subtitle">Chọn năm để xem danh sách phim phát hành năm đó.</p>
        </div>

        <div className="year-grid genre-grid">
          {YEARS.map((year) => (
            <Link
              key={year}
              to={`/nam/${year}`}
              className="genre-card"
            >
              <span className="genre-card-icon">📅</span>
              <span className="genre-card-name">{year}</span>
              <i className="fas fa-chevron-right genre-card-arrow" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
