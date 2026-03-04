import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { user as userApi } from '../api/client';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../utils/imageUrl.js';
import { toTitleCase } from '../utils/titleCase.js';

const POSTER_PLACEHOLDER = NO_POSTER_DATA_URL;
const SECTION_SIZE = 6;

export default function ContinueWatchingSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    userApi
      .history()
      .then((res) => {
        const list = res?.data ?? [];
        const seenIds = new Set();
        const continueList = (Array.isArray(list) ? list : [])
          .filter((m) => m && (m.completed !== 1 || (m.progress != null && m.progress > 0 && m.progress < 90)))
          .filter((m) => {
            if (seenIds.has(m.id)) return false;
            seenIds.add(m.id);
            return true;
          })
          .slice(0, SECTION_SIZE);
        setItems(continueList);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user || loading) return null;
  if (!items.length) return null;

  return (
    <section className="section continue-watching-section home-section-with-grid">
      <div className="container">
        <div className="home-section-header">
          <h2 className="home-section-title">
            <span className="bar" aria-hidden />
            <span className="home-section-title-text">Tiếp Tục Xem</span>
          </h2>
        </div>
      </div>
      <div className="home-section-grid-wrap">
        <div className="home-section-grid-7x2">
          {items.map((m) => (
            <div key={m.id} className="continue-watching-card-wrap">
              <button
                type="button"
                className="continue-watching-remove"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  userApi.removeHistory(m.id).then(() => {
                    setItems((prev) => prev.filter((x) => x.id !== m.id));
                    toast.success('Đã xóa khỏi Tiếp tục xem.');
                  }).catch(() => toast.error('Không thể xóa.'));
                }}
                aria-label="Xóa khỏi tiếp tục xem"
                title="Xóa khỏi tiếp tục xem"
              >
                <i className="fas fa-times" />
              </button>
              <Link to={`/watch/${m.id}${(m.episode != null && m.episode > 1) ? `?ep=${m.episode}` : ''}`} className="movie-card continue-watching-card">
                <div className="movie-card-poster continue-watching-poster">
                  <img
                    src={imageDisplayUrl(m.poster) || POSTER_PLACEHOLDER}
                    alt={toTitleCase(m.title)}
                    loading="lazy"
                    onError={(e) => {
                      if (e.target.src !== POSTER_PLACEHOLDER) {
                        e.target.onerror = null;
                        e.target.src = POSTER_PLACEHOLDER;
                      }
                    }}
                  />
                  <div className="movie-card-overlay">
                    <span className="movie-card-play"><i className="fas fa-play" style={{ marginLeft: '3px' }} /></span>
                  </div>
                  <span className="continue-watching-badge-local">Đang xem</span>
                  {m.progress != null && m.progress > 0 && m.progress < 100 && (
                    <div className="continue-watching-progress-bar">
                      <div className="continue-watching-progress-fill" style={{ width: `${m.progress}%` }} />
                    </div>
                  )}
                </div>
                <div className="movie-card-info">
                  <h3 className="movie-card-title">{toTitleCase(m.title)}</h3>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
