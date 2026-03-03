import { Link } from 'react-router-dom';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../utils/imageUrl.js';
import { toTitleCase } from '../utils/titleCase.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const POSTER_PLACEHOLDER = NO_POSTER_DATA_URL;

/** Nhãn ngôn ngữ theo lang_key (lt | tm | vs). */
const LANG_LABELS = { lt: 'Lồng Tiếng', tm: 'Thuyết Minh', vs: 'Vietsub' };

/** Rút ra mảng các key từ lang_key (string hoặc array) hoặc từ chuỗi language. */
function parseLangKeys(movie) {
  const keys = new Set();
  if (movie.lang_key != null) {
    const raw = Array.isArray(movie.lang_key) ? movie.lang_key : [movie.lang_key];
    raw.forEach((v) => {
      const s = String(v).toLowerCase().trim();
      if (s === 'lt' || s === 'tm' || s === 'vs') keys.add(s);
      s.split(/[,+]+/).forEach((part) => {
        const p = part.trim().toLowerCase();
        if (p === 'lt' || p === 'tm' || p === 'vs') keys.add(p);
      });
    });
  }
  if (movie.language && typeof movie.language === 'string') {
    const s = movie.language.toLowerCase();
    if (/\bvs\b|vietsub|viet\s*sub|phụ\s*đề|phu\s*de/i.test(s)) keys.add('vs');
    if (/\btm\b|thuyết\s*minh|thuyet\s*minh/i.test(s)) keys.add('tm');
    if (/\blt\b|lồng\s*tiếng|long\s*tieng/i.test(s)) keys.add('lt');
  }
  return Array.from(keys);
}

/** Lấy nhãn ngôn ngữ. */
function getLangLabel(movie) {
  if (!movie) return null;
  const parsed = parseLangKeys(movie);
  if (parsed.includes('vs') && parsed.includes('tm')) return 'VS + TM';
  if (parsed.length === 1 && LANG_LABELS[parsed[0]]) return LANG_LABELS[parsed[0]];
  if (parsed.length > 1) {
    const order = ['lt', 'tm', 'vs'];
    const sorted = [...parsed].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return sorted.map((k) => (k === 'vs' ? 'VS' : k === 'tm' ? 'TM' : LANG_LABELS[k])).join(' + ');
  }
  if (movie.language && String(movie.language).trim()) return String(movie.language).trim();
  return null;
}

function isNew(createdAt) {
  if (!createdAt) return false;
  const t = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt;
  return Date.now() - t < THIRTY_DAYS_MS;
}

/** Chuẩn hóa quality từ API để hiển thị (in hoa hết: HD, FULL HD, 720P, 4K...). */
function formatQuality(quality) {
  if (!quality || typeof quality !== 'string') return null;
  const s = String(quality).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'fullhd' || lower === 'full hd' || lower === 'fhd') return 'FULL HD';
  if (lower === 'hd') return 'HD';
  if (/^\d+p$/i.test(lower)) return lower.replace(/(\d+)p/, '$1P'); // 720p -> 720P
  if (lower === '4k' || lower === 'uhd') return '4K';
  return s.toUpperCase();
}

/** Nhãn tập cho phim bộ / anime / tvshows. Trả về { label, completed } để hiển thị "Hoàn Thành N Tập". */
function getEpisodeBadge(movie) {
  if (!movie) return null;
  const isSeries = movie.type === 'series' || movie.type === 'anime' || movie.type === 'tvshows';
  if (!isSeries) return null;
  const raw = movie.episode_current;
  const total = movie.total_episodes != null ? Math.max(0, parseInt(movie.total_episodes, 10) || 0) : 0;

  if (typeof raw === 'string' && /hoàn\s*tất/i.test(raw.trim())) return total > 0 ? { label: `Hoàn Thành ${total} Tập`, completed: true } : { label: 'Hoàn Tất', completed: true };
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim();
    const numMatch = trimmed.match(/tập\s*(\d+)/i) || trimmed.match(/(\d+)/);
    if (numMatch) return { label: `Tập ${numMatch[1]}`, completed: false };
    const num = parseInt(trimmed, 10);
    if (Number.isFinite(num) && num > 0) return { label: `Tập ${num}`, completed: false };
  }

  const current = raw != null ? Math.max(0, parseInt(raw, 10) || 0) : null;
  if (total === 0 && current === null) return null;
  if (current != null && total > 0 && current >= total) return { label: `Hoàn Thành ${total} Tập`, completed: true };
  if (current != null && current > 0) return { label: `Tập ${current}`, completed: false };
  if (total > 0) return { label: `Tập ${total}`, completed: false };
  return null;
}

/** Top-left: FHD (xanh), Vietsub / Thuyết Minh (vàng) — xếp dọc. */
function Badges({ movie, showNewBadge = false }) {
  const qualityLabel = movie.quality ? formatQuality(movie.quality) : null;
  const showMoi = showNewBadge && (movie.featured === 1 || movie.featured === true || isNew(movie.created_at));
  const langKeys = parseLangKeys(movie);
  const langLabels = langKeys.map((k) => (k === 'vs' ? 'Vietsub' : k === 'tm' ? 'Thuyết Minh' : LANG_LABELS[k] || k));
  if (!qualityLabel && !showMoi && !langLabels.length) return null;
  return (
    <div className="movie-card-badges" aria-hidden="true">
      {showMoi && <span className="movie-badge badge-moi">MỚI</span>}
      {qualityLabel && <span className="movie-badge badge-hd">{qualityLabel}</span>}
      {langLabels.map((l) => (
        <span key={l} className="movie-badge badge-lang">{l}</span>
      ))}
    </div>
  );
}

export default function MovieCard({ movie, showRating = true, showBadges = false, showNewBadge = false }) {
  const poster = imageDisplayUrl(movie.poster) || POSTER_PLACEHOLDER;
  const href = `/movie/${movie.id}`;
  const year = movie.release_year ? `${movie.release_year}` : '';
  const country = movie.country || '';
  const langLabel = getLangLabel(movie);
  const meta = [year, country, langLabel].filter(Boolean).join(' • ');

  const onPosterError = (e) => {
    if (e.target.src !== POSTER_PLACEHOLDER) {
      e.target.onerror = null;
      e.target.src = POSTER_PLACEHOLDER;
    }
  };

  const episodeBadge = getEpisodeBadge(movie);
  const titleText = toTitleCase(movie.title);

  return (
    <Link to={href} className="movie-card">
      <div className="movie-card-poster">
        <img src={poster} alt={titleText} loading="lazy" onError={onPosterError} />
        {showBadges && <Badges movie={movie} showNewBadge={showNewBadge} />}
        {showRating && movie.rating > 0 && (
          <span className="movie-card-rating"><i className="fas fa-star star" /> {Number(movie.rating).toFixed(1)}</span>
        )}
        {showBadges && episodeBadge && (
          <div className={`movie-card-episode-badge ${episodeBadge.completed ? 'movie-card-episode-badge--completed' : ''}`}>
            {episodeBadge.label}
          </div>
        )}
        <div className="movie-card-overlay">
          <span className="movie-card-play"><i className="fas fa-play" style={{ marginLeft: '3px' }} /></span>
        </div>
      </div>
      <div className="movie-card-info">
        <h3 className="movie-card-title">{titleText}</h3>
        {showBadges ? (
          meta ? <p className="movie-card-meta">{meta}</p> : null
        ) : (
          <>
            {movie.genres?.length > 0 && (
              <p className="movie-card-genres">{movie.genres.join(', ')}</p>
            )}
            {meta ? <p className="movie-card-meta">{meta}</p> : (movie.release_year ? <span className="movie-card-year">{movie.release_year}</span> : null)}
          </>
        )}
      </div>
    </Link>
  );
}
