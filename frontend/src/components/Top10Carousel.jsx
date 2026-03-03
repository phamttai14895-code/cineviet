import { Link } from 'react-router-dom';
import HomeMovieCard from './HomeMovieCard';

const SECTION_SIZE = 6;

export default function Top10Carousel({ movies = [], title = 'Top 10 Phim Xem Nhiều Nhất' }) {
  const list = (movies || []).slice(0, SECTION_SIZE);
  if (!list.length) return null;

  return (
    <section className="section home-section-with-grid" aria-label={title}>
      <div className="container">
        <div className="home-section-header">
          <h2 className="home-section-title">
            <span className="bar" aria-hidden />
            {title}
          </h2>
          <Link to="/phim-moi" className="home-section-view-all">
            Xem tất cả <i className="fas fa-chevron-right" />
          </Link>
        </div>
      </div>
      <div className="home-section-grid-wrap">
        <div className="home-section-grid-7x2">
          {list.map((m) => (
            <HomeMovieCard key={m.id} movie={m} />
          ))}
        </div>
      </div>
    </section>
  );
}
