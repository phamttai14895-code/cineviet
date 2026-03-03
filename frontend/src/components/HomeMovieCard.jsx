import MovieCard from './MovieCard';
import HoverPopupCard from './HoverPopupCard';

/** Thẻ phim dùng trên Home: rê chuột vào thì hiện popup chi tiết đè lên thẻ (chỉ desktop). */
export default function HomeMovieCard({ movie }) {
  return (
    <HoverPopupCard movie={movie} className="home-movie-card-wrap">
      <MovieCard movie={movie} showBadges />
    </HoverPopupCard>
  );
}
