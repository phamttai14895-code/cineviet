import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { movies as moviesApi } from '../api/client';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../utils/imageUrl.js';
import { toTitleCase } from '../utils/titleCase.js';

const TRENDING_LIMIT = 6;
const RANK_COLORS = [
  '#facc15',   /* 1 yellow */
  '#22d3ee',   /* 2 aqua */
  '#fb923c',   /* 3 orange */
  '#0d9488',   /* 4 teal */
  '#d97706',   /* 5 amber/brown */
  '#94a3b8',   /* 6 grey */
];

/**
 * Block thịnh hành dùng chung: title, subtitle, listParams (type, chieu_rap, sort, order, limit).
 * Dùng cho phim-le, phim-bo, phim-moi, tv-shows, anime, phim-chieu-rap.
 */
export default function TrendingBlock({ title, subtitle = 'Được xem nhiều nhất tuần này', listParams }) {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    const params = {
      sort: 'view_count',
      order: 'desc',
      limit: TRENDING_LIMIT,
      ...(listParams && typeof listParams === 'object' ? listParams : {}),
    };
    moviesApi
      .list(params)
      .then((r) => setMovies(r.data?.movies || []))
      .catch(() => setMovies([]));
  }, [title, listParams?.type, listParams?.chieu_rap]);

  if (!movies.length) return null;

  return (
    <section className="phim-le-trending" aria-label={title}>
      <div className="phim-le-trending-header">
        <h2 className="phim-le-trending-title">{title}</h2>
        <p className="phim-le-trending-subtitle">{subtitle}</p>
      </div>
      <div className="phim-le-trending-row">
        {movies.map((m, i) => (
          <TrendingCard key={m.id} movie={m} rank={i + 1} rankColor={RANK_COLORS[i]} />
        ))}
      </div>
    </section>
  );
}

function TrendingCard({ movie, rank, rankColor }) {
  const poster = imageDisplayUrl(movie.poster) || imageDisplayUrl(movie.thumbnail) || NO_POSTER_DATA_URL;
  const title = toTitleCase(movie.title);
  const viewCount = movie.view_count != null ? Number(movie.view_count) : null;

  return (
    <Link to={`/movie/${movie.id}`} className="phim-le-trending-card">
      <span className="phim-le-trending-rank" style={{ '--rank-glow': rankColor }} aria-hidden>
        {rank}
      </span>
      <div className="phim-le-trending-poster-wrap">
        <img src={poster} alt={title} className="phim-le-trending-poster" loading="lazy" />
        <span className="phim-le-trending-fhd">FHD</span>
        <div className="phim-le-trending-poster-overlay">
          <h3 className="phim-le-trending-card-title">{title}</h3>
          {viewCount != null && (
            <p className="phim-le-trending-views">
              <i className="fas fa-eye" aria-hidden /> {viewCount} lượt xem
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
