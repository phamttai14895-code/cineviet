import { Link } from 'react-router-dom';
import HomeMovieCard from './HomeMovieCard';

const SECTION_SIZE = 6;

export default function UpcomingCarousel({ movies = [] }) {
  const list = movies.slice(0, SECTION_SIZE);
  const hasMovies = list.length > 0;

  return (
    <section className="upcoming-section section home-section-with-grid" aria-label="Phim Sắp Tới">
      <div className="container">
        <div className="home-section-header">
          <h2 className="home-section-title">
            <span className="bar" aria-hidden />
            <span className="home-section-title-text">Phim Sắp Tới</span>
          </h2>
          {hasMovies && (
            <Link to="/phim-sap-toi" className="home-section-view-all">
              Xem tất cả <i className="fas fa-chevron-right" />
            </Link>
          )}
        </div>
      </div>
      <div className="home-section-grid-wrap">
        {hasMovies ? (
          <div className="home-section-grid-7x2">
            {list.map((m) => (
              <HomeMovieCard key={m.id} movie={m} />
            ))}
          </div>
        ) : (
          <p className="upcoming-empty">Chưa có phim sắp chiếu.</p>
        )}
      </div>
    </section>
  );
}
