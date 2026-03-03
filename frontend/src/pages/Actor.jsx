import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { actors as actorsApi } from '../api/client';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../utils/imageUrl.js';
import { toTitleCase } from '../utils/titleCase.js';
import { useSeo } from '../hooks/useSeo.js';
import { useBreadcrumb } from '../context/BreadcrumbContext';
import './Actor.css';

export default function Actor() {
  const { slug } = useParams();
  const [actor, setActor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'time'
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef(null);

  useEffect(() => {
    actorsApi
      .get(slug)
      .then((r) => setActor(r.data))
      .catch(() => setActor(null))
      .finally(() => setLoading(false));
  }, [slug]);

  useSeo(actor?.name, actor?.biography);
  const { setBreadcrumbItems } = useBreadcrumb();

  useEffect(() => {
    if (!actor) return;
    setBreadcrumbItems([{ label: 'Trang chủ', to: '/' }, { label: 'Diễn viên', to: '/dien-vien' }, { label: actor.name }]);
    return () => setBreadcrumbItems([]);
  }, [actor?.name, setBreadcrumbItems]);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2800);
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast('Đã copy link!'));
    } else {
      showToast('Đã copy link!');
    }
  };

  if (loading) {
    return (
      <div className="actor-detail-page">
        <div className="actor-detail-loading">Đang tải...</div>
      </div>
    );
  }
  if (!actor) {
    return (
      <div className="actor-detail-page">
        <div className="actor-detail-error">Không tìm thấy diễn viên.</div>
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <Link to="/dien-vien" className="actor-detail-btn">Về danh sách diễn viên</Link>
        </div>
      </div>
    );
  }

  const filmography = actor.filmography || [];
  const filmographyByYear = filmography.reduce((acc, m) => {
    const y = m.release_year || 0;
    if (!acc[y]) acc[y] = [];
    acc[y].push(m);
    return acc;
  }, {});
  const years = Object.keys(filmographyByYear).map(Number).sort((a, b) => b - a);

  const posterUrl = (url) => imageDisplayUrl(url) || NO_POSTER_DATA_URL;
  const onPosterError = (e) => {
    if (e.target.src !== NO_POSTER_DATA_URL) {
      e.target.onerror = null;
      e.target.src = NO_POSTER_DATA_URL;
    }
  };

  const episodeBadge = (m) => {
    const isSeries = m.type === 'series' || m.type === 'anime';
    if (isSeries && m.total_episodes) return `PD. ${m.total_episodes}`;
    return 'PD. Full';
  };

  const genderLabel = actor.gender != null
    ? (actor.gender === 1 ? 'Nữ' : actor.gender === 2 ? 'Nam' : 'Không xác định')
    : null;

  return (
    <div className="actor-detail-page">
      <div className="actor-detail-layout">
        {/* Sidebar trái */}
        <aside className="actor-detail-sidebar">
          <div className="actor-detail-avatar-wrap">
            {actor.avatar ? (
              <img src={imageDisplayUrl(actor.avatar)} alt="" className="actor-detail-avatar-img" />
            ) : (
              <div className="actor-detail-avatar-ph">
                <span>{actor.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          <h1 className="actor-detail-name">{actor.name}</h1>
          <div className="actor-detail-actions">
            <button type="button" className="actor-detail-btn actor-detail-btn-pill" aria-label="Yêu thích">
              <i className="fas fa-heart" /> Yêu thích
            </button>
            <button type="button" className="actor-detail-btn actor-detail-btn-pill" onClick={handleShare}>
              <i className="fas fa-paper-plane" /> Chia sẻ
            </button>
          </div>
          <div className="actor-detail-meta">
            {(actor.other_names != null && actor.other_names !== '') && (
              <div className="actor-detail-meta-row">
                <span className="actor-detail-meta-label">Tên gọi khác:</span>
                <span className="actor-detail-meta-value">{actor.other_names}</span>
              </div>
            )}
            {genderLabel && (
              <div className="actor-detail-meta-row">
                <span className="actor-detail-meta-label">Giới tính:</span>
                <span className="actor-detail-meta-value">{genderLabel}</span>
              </div>
            )}
            {(actor.birthday != null && actor.birthday !== '') && (
              <div className="actor-detail-meta-row">
                <span className="actor-detail-meta-label">Ngày sinh:</span>
                <span className="actor-detail-meta-value">{actor.birthday}</span>
              </div>
            )}
            {(actor.place_of_birth != null && actor.place_of_birth !== '') && (
              <div className="actor-detail-meta-row">
                <span className="actor-detail-meta-label">Nơi sinh:</span>
                <span className="actor-detail-meta-value">{actor.place_of_birth}</span>
              </div>
            )}
            <div className="actor-detail-meta-row">
              <span className="actor-detail-meta-label">Giới thiệu:</span>
              <span className="actor-detail-meta-value actor-detail-bio">{actor.biography || actor.bio || 'Đang cập nhật'}</span>
            </div>
          </div>
        </aside>

        {/* Nội dung phải */}
        <main className="actor-detail-main">
          <h2 className="actor-detail-section-title">Các phim đã tham gia</h2>
          <div className="actor-detail-filters">
            <button
              type="button"
              className={`actor-detail-filter ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`actor-detail-filter ${viewMode === 'time' ? 'active' : ''}`}
              onClick={() => setViewMode('time')}
            >
              Thời gian
            </button>
          </div>

          {viewMode === 'all' && (
            <div className="actor-detail-grid">
              {filmography.map((m) => (
                <Link key={m.id} to={`/movie/${m.slug || m.id}`} className="actor-detail-film-card">
                  <div className="actor-detail-film-poster">
                    {m.poster ? (
                      <img src={posterUrl(m.poster)} alt={toTitleCase(m.title)} loading="lazy" onError={onPosterError} />
                    ) : (
                      <div className="actor-detail-film-poster-ph">🎬</div>
                    )}
                    <span className="actor-detail-film-badge">{episodeBadge(m)}</span>
                  </div>
                  <div className="actor-detail-film-title">{toTitleCase(m.title)}</div>
                  {m.title_en && <div className="actor-detail-film-title-en">{toTitleCase(m.title_en)}</div>}
                </Link>
              ))}
            </div>
          )}

          {viewMode === 'time' && (
            <div className="actor-detail-timeline">
              {years.map((year) => (
                <div key={year} className="actor-detail-timeline-year-block">
                  <div className="actor-detail-timeline-year-marker">{year}</div>
                  <div className="actor-detail-timeline-dot" />
                  <div className="actor-detail-timeline-films">
                    {filmographyByYear[year].map((m) => (
                      <Link key={m.id} to={`/movie/${m.slug || m.id}`} className="actor-detail-film-card actor-detail-film-card-inline">
                        <div className="actor-detail-film-poster">
                          {m.poster ? (
                            <img src={posterUrl(m.poster)} alt={toTitleCase(m.title)} loading="lazy" onError={onPosterError} />
                          ) : (
                            <div className="actor-detail-film-poster-ph">🎬</div>
                          )}
                          <span className="actor-detail-film-badge">{episodeBadge(m)}</span>
                        </div>
                        <div className="actor-detail-film-titles">
                          <div className="actor-detail-film-title">{toTitleCase(m.title)}</div>
                          {m.title_en && <div className="actor-detail-film-title-en">{toTitleCase(m.title_en)}</div>}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className={`actor-detail-toast ${toast ? 'show' : ''}`}>
          <i className="fas fa-check-circle" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
