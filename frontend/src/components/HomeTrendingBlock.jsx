import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { home as homeApi } from '../api/client';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../utils/imageUrl';
import { toTitleCase } from '../utils/titleCase.js';
import { useDragToScroll } from '../hooks/useDragToScroll';

const PLACEHOLDER_POSTER = NO_POSTER_DATA_URL;

export default function HomeTrendingBlock() {
  const [data, setData] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [modalType, setModalType] = useState(null); // 'popular' | 'liked' | 'comments'
  const carouselRef = useRef(null);
  useDragToScroll(carouselRef);

  useEffect(() => {
    homeApi.trendingBlock()
      .then((r) => setData(r.data))
      .catch(() => setData({ topComments: [], popularMovies: [], mostLikedMovies: [], newComments: [], totalComments: 0 }));
  }, []);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || !data?.topComments?.length) return;
    const cardWidth = 320;
    const maxScroll = Math.max(0, data.topComments.length * cardWidth - el.offsetWidth);
    el.scrollTo({ left: Math.min(carouselIndex * cardWidth, maxScroll), behavior: 'smooth' });
  }, [carouselIndex, data?.topComments?.length]);

  useEffect(() => {
    if (!modalType) return;
    const onKey = (e) => { if (e.key === 'Escape') setModalType(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalType]);

  if (!data) return null;

  const { topComments, popularMovies, mostLikedMovies, newComments } = data;
  const hasTop = topComments?.length > 0;
  const hasPopular = popularMovies?.length > 0;
  const hasLiked = mostLikedMovies?.length > 0;
  const hasNew = newComments?.length > 0;
  const hasAny = hasTop || hasPopular || hasLiked || hasNew;
  if (!hasAny) return null;

  const totalTop = topComments?.length || 0;

  return (
    <section className="home-trending-block" aria-label="Bình luận và phim nổi bật">
      <div className="container">
        {/* TOP BÌNH LUẬN - Luôn hiển thị tiêu đề, carousel hoặc trạng thái trống */}
        <div className="trending-top-comments">
          <h2 className="trending-section-title">
            <span className="trending-title-bar" aria-hidden />
            <i className="fas fa-crown trending-title-icon" aria-hidden />
            TOP BÌNH LUẬN
          </h2>
          {hasTop ? (
            <div className="trending-top-carousel-wrap">
              {totalTop > 1 && (
                <button
                  type="button"
                  className="trending-carousel-arrow trending-carousel-prev"
                  onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                  aria-label="Trước"
                >
                  <i className="fas fa-chevron-left" />
                </button>
              )}
              <div className="trending-top-carousel" ref={carouselRef}>
                {topComments.map((c) => (
                  <div key={c.id} className="trending-comment-card">
                    <img
                      src={c.user_avatar ? (c.user_avatar.startsWith('http') ? imageDisplayUrl(c.user_avatar) : c.user_avatar) : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user_name || 'U')}&background=3d5a80&color=fff`}
                      alt=""
                      className="trending-comment-avatar"
                    />
                    <div className="trending-comment-body">
                      <div className="trending-comment-line1">
                        <span className="trending-comment-username">{c.user_name}</span>
                        <span className="trending-comment-infinity" aria-hidden>∞</span>
                      </div>
                      <p className="trending-comment-content">{c.content}</p>
                      <div className="trending-comment-actions">
                        <span className="trending-comment-replies"><i className="fas fa-comment" /> {data.totalComments ?? 0}</span>
                      </div>
                    </div>
                    <Link to={`/movie/${c.movie_slug || c.movie_id}`} className="trending-comment-poster">
                      <img src={imageDisplayUrl(c.movie_thumbnail || c.movie_poster) || PLACEHOLDER_POSTER} alt="" loading="lazy" decoding="async" />
                    </Link>
                  </div>
                ))}
              </div>
              {totalTop > 1 && (
                <button
                  type="button"
                  className="trending-carousel-arrow trending-carousel-next"
                  onClick={() => setCarouselIndex((i) => Math.min(totalTop - 1, i + 1))}
                  aria-label="Sau"
                >
                  <i className="fas fa-chevron-right" />
                </button>
              )}
            </div>
          ) : (
            <p className="trending-top-empty">Chưa có bình luận nào. Hãy xem phim và để lại bình luận nhé!</p>
          )}
        </div>

        {/* 3 cột: Sôi nổi nhất | Yêu thích nhất | Bình luận mới */}
        <div className="trending-three-cols">
          {/* SÔI NỔI NHẤT */}
          <div className="trending-col">
            <h3 className="trending-col-title">
              <span className="trending-col-bar" aria-hidden />
              <i className="fas fa-film" aria-hidden />
              SÔI NỔI NHẤT
            </h3>
            <ul className="trending-list">
              {popularMovies?.slice(0, 5).map((m, i) => (
                <li key={m.id}>
                  <Link to={`/movie/${m.slug || m.id}`} className="trending-list-item">
                    <span className="trending-list-rank">{i + 1}.</span>
                    <img src={imageDisplayUrl(m.thumbnail || m.poster) || PLACEHOLDER_POSTER} alt="" className="trending-list-thumb" loading="lazy" decoding="async" />
                    <span className="trending-list-title">{toTitleCase(m.title)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/phim-moi?sort=view_count" className="trending-col-more" onClick={(e) => { e.preventDefault(); setModalType('popular'); }} role="button" tabIndex={0}>Xem thêm <i className="fas fa-chevron-right" /></Link>
          </div>

          {/* YÊU THÍCH NHẤT */}
          <div className="trending-col">
            <h3 className="trending-col-title">
              <span className="trending-col-bar" aria-hidden />
              <i className="fas fa-heart" aria-hidden />
              YÊU THÍCH NHẤT
            </h3>
            <ul className="trending-list">
              {mostLikedMovies?.slice(0, 5).map((m, i) => (
                <li key={m.id}>
                  <Link to={`/movie/${m.slug || m.id}`} className="trending-list-item">
                    <span className="trending-list-rank">{i + 1}.</span>
                    <img src={imageDisplayUrl(m.thumbnail || m.poster) || PLACEHOLDER_POSTER} alt="" className="trending-list-thumb" loading="lazy" decoding="async" />
                    <span className="trending-list-title">{toTitleCase(m.title)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/phim-moi" className="trending-col-more" onClick={(e) => { e.preventDefault(); setModalType('liked'); }} role="button" tabIndex={0}>Xem thêm <i className="fas fa-chevron-right" /></Link>
          </div>

          {/* BÌNH LUẬN MỚI */}
          <div className="trending-col">
            <h3 className="trending-col-title">
              <span className="trending-col-bar" aria-hidden />
              <i className="fas fa-bolt" aria-hidden />
              BÌNH LUẬN MỚI
            </h3>
            <ul className="trending-new-comments">
              {newComments?.slice(0, 5).map((c) => (
                <li key={c.id} className="trending-new-comment">
                  <div className="trending-new-comment-card">
                    <img
                      src={c.user_avatar ? (c.user_avatar.startsWith('http') ? imageDisplayUrl(c.user_avatar) : c.user_avatar) : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user_name || 'U')}&background=3d5a80&color=fff`}
                      alt=""
                      className="trending-new-comment-avatar"
                    />
                    <div className="trending-new-comment-body">
                      <div className="trending-new-comment-line1">
                        <span className="trending-new-comment-name">{c.user_name}</span>
                        <span className="trending-new-comment-infinity" aria-hidden>∞</span>
                        <span className="trending-new-comment-content">{c.content}</span>
                      </div>
                      <Link to={`/movie/${c.movie_slug || c.movie_id}`} className="trending-new-comment-movie">
                        <i className="fas fa-play" aria-hidden />
                        {c.movie_title ? toTitleCase(c.movie_title) : ''}
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/phim-moi" className="trending-col-more" onClick={(e) => { e.preventDefault(); setModalType('comments'); }} role="button" tabIndex={0}>Xem thêm <i className="fas fa-chevron-right" /></Link>
          </div>
        </div>
      </div>

      {/* Modal Xem thêm: 10 phim sôi nổi / yêu thích / 10 bình luận mới */}
      {modalType && (
        <div className="trending-modal-backdrop" onClick={() => setModalType(null)} role="presentation">
          <div className="trending-modal" onClick={(e) => e.stopPropagation()}>
            <div className="trending-modal-header">
              <h3 className="trending-modal-title">
                {modalType === 'popular' && <><i className="fas fa-film" /> Sôi nổi nhất</>}
                {modalType === 'liked' && <><i className="fas fa-heart" /> Yêu thích nhất</>}
                {modalType === 'comments' && <><i className="fas fa-bolt" /> Bình luận mới</>}
              </h3>
              <button type="button" className="trending-modal-close" onClick={() => setModalType(null)} aria-label="Đóng">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="trending-modal-body">
              {modalType === 'popular' && (
                <ul className="trending-modal-list">
                  {popularMovies?.map((m, i) => (
                    <li key={m.id}>
                      <Link to={`/movie/${m.slug || m.id}`} className="trending-list-item" onClick={() => setModalType(null)}>
                        <span className="trending-list-rank">{i + 1}.</span>
                        <img src={imageDisplayUrl(m.thumbnail || m.poster) || PLACEHOLDER_POSTER} alt="" className="trending-list-thumb" loading="lazy" decoding="async" />
                        <span className="trending-list-title">{toTitleCase(m.title)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {modalType === 'liked' && (
                <ul className="trending-modal-list">
                  {mostLikedMovies?.map((m, i) => (
                    <li key={m.id}>
                      <Link to={`/movie/${m.slug || m.id}`} className="trending-list-item" onClick={() => setModalType(null)}>
                        <span className="trending-list-rank">{i + 1}.</span>
                        <img src={imageDisplayUrl(m.thumbnail || m.poster) || PLACEHOLDER_POSTER} alt="" className="trending-list-thumb" loading="lazy" decoding="async" />
                        <span className="trending-list-title">{toTitleCase(m.title)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {modalType === 'comments' && (
                <ul className="trending-new-comments trending-modal-comments">
                  {newComments?.map((c) => (
                    <li key={c.id} className="trending-new-comment">
                      <div className="trending-new-comment-card">
                        <img
                          src={c.user_avatar ? (c.user_avatar.startsWith('http') ? imageDisplayUrl(c.user_avatar) : c.user_avatar) : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user_name || 'U')}&background=3d5a80&color=fff`}
                          alt=""
                          className="trending-new-comment-avatar"
                        />
                        <div className="trending-new-comment-body">
                          <div className="trending-new-comment-line1">
                            <span className="trending-new-comment-name">{c.user_name}</span>
                            <span className="trending-new-comment-infinity" aria-hidden>∞</span>
                            <span className="trending-new-comment-content">{c.content}</span>
                          </div>
                          <Link to={`/movie/${c.movie_slug || c.movie_id}`} className="trending-new-comment-movie" onClick={() => setModalType(null)}>
                            <i className="fas fa-play" aria-hidden />
                            {c.movie_title}
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
