import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { movies as moviesApi, user as userApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MovieCard from '../components/MovieCard';
import CommentActions from '../components/CommentActions';
import CommentInputWithEmoji from '../components/CommentInputWithEmoji';
import TrailerModal from '../components/TrailerModal';
import WatchRateBanner from '../components/WatchRateBanner';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../utils/imageUrl.js';
import { formatRelativeTimeGMT7 } from '../utils/dateGMT7.js';
import { toTitleCase } from '../utils/titleCase.js';
import { slugify } from '../utils/slugify.js';
import { useSeo } from '../hooks/useSeo.js';
import { MovieJsonLd, BreadcrumbJsonLd } from '../components/JsonLd';
import { useBreadcrumb } from '../context/BreadcrumbContext';

function formatDuration(mins) {
  if (!mins || mins < 1) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}p` : `${m} phút`;
}

function formatDurationPerEp(mins) {
  if (!mins || mins < 1) return null;
  return `${mins} phút/tập`;
}


export default function MovieDetail() {
  const { idOrSlug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const typeLabel = (type) => {
    if (type === 'series') return 'Phim bộ';
    if (type === 'anime') return 'Anime';
    return 'Phim lẻ';
  };
  const { user, openLoginModal } = useAuth();
  const [movie, setMovie] = useState(null);
  const [comments, setComments] = useState([]);
  const [favorited, setFavorited] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [commentSpoiler, setCommentSpoiler] = useState(false);
  const [replyToCommentId, setReplyToCommentId] = useState(null);
  const [spoilerRevealedIds, setSpoilerRevealedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [reportedCommentIds, setReportedCommentIds] = useState(new Set());
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [rateBannerOpen, setRateBannerOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [selectedServerIndex, setSelectedServerIndex] = useState(0);
  const [repliesExpanded, setRepliesExpanded] = useState(new Set());

  const seoImage = !movie ? undefined : (() => {
    const raw = movie.backdrop || movie.poster;
    if (!raw) return undefined;
    const d = imageDisplayUrl(raw);
    if (!d) return undefined;
    return d.startsWith('http') ? d : (typeof window !== 'undefined' ? window.location.origin + (d.startsWith('/') ? d : '/' + d) : '');
  })();
  useSeo(movie?.title, movie?.overview, seoImage);
  const { setBreadcrumbItems } = useBreadcrumb();

  useEffect(() => {
    moviesApi
      .get(idOrSlug)
      .then((r) => setMovie(r.data))
      .catch(() => setMovie(null))
      .finally(() => setLoading(false));
  }, [idOrSlug]);

  useEffect(() => {
    if (!movie) return;
    setBreadcrumbItems([{ label: 'Trang chủ', to: '/' }, { label: toTitleCase(movie.title) }]);
    return () => setBreadcrumbItems([]);
  }, [movie?.id, movie?.title, setBreadcrumbItems]);

  useEffect(() => {
    if (!movie) return;
    moviesApi.comments(movie.id).then((r) => setComments(r.data || [])).catch(() => setComments([]));
  }, [movie?.id]);

  useEffect(() => {
    if (!user || !movie) return;
    userApi.favoriteIds().then((r) => setFavorited(r.data.includes(movie.id)));
  }, [user, movie?.id]);

  useEffect(() => {
    if (!user) return;
    userApi.reportedCommentIds().then((r) => setReportedCommentIds(new Set(r.data?.comment_ids || []))).catch(() => setReportedCommentIds(new Set()));
  }, [user]);

  const handleFavorite = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    try {
      const { data } = await moviesApi.favorite(movie.id);
      setFavorited(data.favorited);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRatedFromBanner = (rating, newAverage) => {
    setUserRating(rating);
    if (newAverage != null) setMovie((m) => ({ ...m, rating: Math.round(Number(newAverage) * 10) / 10 }));
  };

  const handleReportComment = async (commentId) => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (reportedCommentIds.has(commentId)) return;
    try {
      await userApi.reportComment(commentId);
      setReportedCommentIds((prev) => new Set(prev).add(commentId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = movie?.title || 'Phim';
    try {
      if (navigator.share) {
        await navigator.share({ title, url, text: title });
        setShareCopied(true);
      } else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
      }
      setTimeout(() => setShareCopied(false), 2000);
    } catch (e) {
      if (e.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url);
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2000);
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || !user) return;
    setCommentSubmitting(true);
    try {
      await moviesApi.createComment(movie.id, {
        content: text,
        is_spoiler: commentSpoiler,
        parent_id: replyToCommentId || undefined,
      });
      const { data } = await moviesApi.comments(movie.id);
      setComments(data || []);
      setCommentText('');
      setCommentSpoiler(false);
      setReplyToCommentId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!user) {
      openLoginModal();
      return;
    }
    try {
      const { data } = await moviesApi.likeComment(movie.id, commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, user_liked: data.liked, like_count: data.like_count } : c
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditComment = (c) => {
    setEditingCommentId(c.id);
    setEditContent(c.content || '');
  };

  const handleSaveEdit = async () => {
    if (editingCommentId == null || !editContent.trim()) return;
    setEditSubmitting(true);
    try {
      const { data } = await moviesApi.updateComment(movie.id, editingCommentId, editContent.trim());
      setComments((prev) => prev.map((x) => (x.id === editingCommentId ? data : x)));
      setEditingCommentId(null);
      setEditContent('');
    } catch (e) {
      console.error(e);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Bạn có chắc muốn xóa bình luận này?')) return;
    try {
      await moviesApi.deleteComment(movie.id, commentId);
      setComments((prev) => prev.filter((x) => x.id !== commentId));
      toast.success('Đã xóa bình luận.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể xóa bình luận');
    }
  };

  if (loading) {
    return (
      <div className="movie-detail-page">
        <div className="container loading-wrap">Đang tải...</div>
      </div>
    );
  }
  if (!movie) {
    return (
      <div className="movie-detail-page">
        <div className="container error-msg">Không tìm thấy phim.</div>
      </div>
    );
  }

  const poster = imageDisplayUrl(movie.poster) || NO_POSTER_DATA_URL;
  const backdrop = imageDisplayUrl(movie.backdrop || movie.poster) || NO_POSTER_DATA_URL;
  const durationStr = formatDuration(movie.duration);
  const durationPerEp = formatDurationPerEp(movie.duration);
  const totalEps = Math.max(0, parseInt(movie.total_episodes, 10) || 0);
  const episodeCurrent = movie.episode_current != null ? Math.max(0, parseInt(movie.episode_current, 10) || 0) : totalEps;
  const hasEpisodes = totalEps > 0 && Array.isArray(movie.episodes) && movie.episodes.some((s) => (s?.server_data?.length || 0) > 0);
  const serverDisplayName = (name) => (name || '')
    .replace(/\s*\[SV\s*#\d+\]\s*/gi, ' ')
    .replace(/\s*\[(Ophim|PhimAPI|Nguonc)\]\s*/gi, ' ')
    .replace(/\s*(Ophim|PhimAPI|Nguonc)\s*[-–]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || name || 'Nguồn';
  const episodesList = Array.isArray(movie.episodes) ? movie.episodes : [];
  const uniqueServers = (() => {
    const seen = new Set();
    return episodesList
      .map((s, i) => ({ index: i, server: s, displayName: serverDisplayName(s.server_name) }))
      .filter(({ displayName }) => {
        if (seen.has(displayName)) return false;
        seen.add(displayName);
        return true;
      });
  })();
  /** Số tập thực sự có link (server đang chọn). Chỉ hiển thị các tập đã có link, tránh hiện tập 25–30 khi mới ra đến 24. */
  const getMaxAvailableEpisodes = () => {
    const server = episodesList[selectedServerIndex];
    const data = server?.server_data || [];
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const hasLink = !!(data[i]?.link_embed?.trim() || data[i]?.link_m3u8?.trim());
      if (hasLink) max = i + 1;
    }
    return max > 0 ? max : totalEps;
  };
  const episodesToShow = getMaxAvailableEpisodes();
  const isPhimLe = movie.type !== 'series' && movie.type !== 'anime' && (movie.type === 'movie' || (totalEps || 0) <= 1);
  const viewCount = movie.view_count != null ? Number(movie.view_count) : null;
  const updatedAt = movie.updated_at ? new Date(movie.updated_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' }) : null;

  const fullDescription = movie.description || '';
  const descWords = fullDescription.trim() ? fullDescription.trim().split(/\s+/) : [];
  const isLongDescription = descWords.length > 50;
  const shortDescription = isLongDescription ? `${descWords.slice(0, 50).join(' ')}…` : fullDescription;

  const onPosterError = (e) => {
    if (e.target.src !== POSTER_PLACEHOLDER) {
      e.target.onerror = null;
      e.target.src = POSTER_PLACEHOLDER;
    }
  };

  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const watchUrl = movie.id ? `${base}/watch/${movie.id}` : '';
  const breadcrumbItems = [
    { name: 'Trang chủ', url: base + '/' },
    { name: toTitleCase(movie.title), url: base + `/movie/${movie.slug || movie.id}` },
  ];

  return (
    <div className="movie-detail-page">
      <MovieJsonLd movie={movie} watchUrl={watchUrl} />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      {/* Hero: nền mờ, poster + FHD badge, meta có icon, Tập/Vietsub, nút Xem Ngay + bookmark + share, thể loại, bloc đánh giá bên phải */}
      <div className="movie-detail-hero">
        <div className="movie-detail-hero-bg">
          <img
            src={backdrop}
            alt=""
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = POSTER_PLACEHOLDER;
            }}
          />
        </div>
        <div className="movie-detail-hero-overlay" />
        <div className="container movie-detail-hero-inner">
          <div className="movie-detail-hero-content">
            <div className="movie-detail-poster-wrap">
              {(movie.quality || totalEps > 0) && (
                <span className="movie-detail-poster-fhd">FHD</span>
              )}
              <img src={poster} alt={toTitleCase(movie.title)} className="movie-detail-poster" onError={onPosterError} />
            </div>
            <div className="movie-detail-hero-info">
              <h1 className="movie-detail-title">{toTitleCase(movie.title)}</h1>
              {movie.title_en && (
                <p className="movie-detail-title-en">{toTitleCase(movie.title_en)}</p>
              )}
              <div className="movie-detail-meta-line">
                {movie.rating > 0 && (
                  <span className="movie-detail-rating-badge">
                    <i className="fas fa-star" /> {Number(movie.rating).toFixed(1)}
                  </span>
                )}
                {typeof viewCount === 'number' && viewCount >= 0 && (
                  <span><i className="fas fa-eye" aria-hidden /> {viewCount} lượt xem</span>
                )}
                {movie.release_year && <span><i className="fas fa-calendar-alt" aria-hidden /> {movie.release_year}</span>}
                {durationPerEp && <span><i className="fas fa-clock" aria-hidden /> {durationPerEp}</span>}
                {movie.quality && <span>{movie.quality}</span>}
                {movie.country && <span><i className="fas fa-globe" aria-hidden /> {movie.country}</span>}
              </div>
              <div className="movie-detail-hero-tags">
                {(movie.type === 'series' || movie.type === 'anime') && totalEps > 0 && (
                  <span className="movie-detail-ep-tag">
                    <i className="fas fa-tv" aria-hidden /> Tập {episodeCurrent}/{totalEps}
                  </span>
                )}
                {movie.language && (
                  <span className="movie-detail-lang-tag">
                    <i className="fas fa-closed-captioning" aria-hidden /> {movie.language}
                  </span>
                )}
              </div>
              <div className="movie-detail-actions">
                <Link to={`/watch/${movie.id}`} className="btn-watch">
                  <i className="fas fa-play" aria-hidden /> Xem Ngay
                </Link>
                <button
                  type="button"
                  className={`btn-fav btn-icon-circle ${favorited ? 'active' : ''}`}
                  onClick={handleFavorite}
                  title={favorited ? 'Bỏ yêu thích' : 'Yêu thích'}
                  aria-label={favorited ? 'Bỏ yêu thích' : 'Yêu thích'}
                >
                  <i className={favorited ? 'fas fa-heart' : 'far fa-heart'} />
                </button>
                <button
                  type="button"
                  className="btn-share btn-icon-circle"
                  onClick={handleShare}
                  title="Chia sẻ"
                  aria-label="Chia sẻ"
                >
                  <i className="fas fa-share-alt" />
                </button>
              </div>
              {movie.genres?.length > 0 && (
                <div className="movie-detail-genres">
                  {movie.genres.map((g) => (
                    <span key={g} className="movie-detail-genre-tag">{typeof g === 'object' && g && g.name ? g.name : g}</span>
                  ))}
                  <span className="movie-detail-genre-tag">{typeLabel(movie.type)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="movie-detail-hero-rate-block">
          <p className="movie-detail-hero-rate-text">
            Tụi mình rất cần lượt đánh giá của bạn để mọi người có thể biết phim hay hay dở đó nhé!
          </p>
          <button
            type="button"
            className="movie-detail-hero-rate-btn"
            onClick={() => setRateBannerOpen(true)}
            aria-label="Đánh giá phim"
          >
            <i className="fas fa-star" aria-hidden /> Đánh giá phim
          </button>
        </div>
      </div>

      {movie.trailer_url && (
        <TrailerModal
          isOpen={trailerOpen}
          onClose={() => setTrailerOpen(false)}
          trailerUrl={movie.trailer_url}
          title={toTitleCase(movie.title)}
        />
      )}

      {rateBannerOpen && movie && (
        <WatchRateBanner
          movie={movie}
          userRating={userRating}
          onClose={() => setRateBannerOpen(false)}
          onRated={handleRatedFromBanner}
        />
      )}

      <div className="container movie-detail-body">
        <div className="movie-detail-body-grid">
          {/* Cột trái: Nội dung, Thông tin, Diễn viên */}
          <div className="movie-detail-body-left">
            <section className="movie-detail-section movie-detail-synopsis">
              <h2 className="movie-detail-section-title">NỘI DUNG PHIM</h2>
              {fullDescription ? (
                <p className="movie-detail-description">
                  {showFullDesc ? fullDescription : shortDescription}
                  {isLongDescription && (
                    <button
                      type="button"
                      className="movie-detail-desc-toggle"
                      onClick={() => setShowFullDesc((v) => !v)}
                    >
                      {showFullDesc ? 'Thu gọn' : 'Xem thêm'} <i className="fas fa-chevron-down" aria-hidden />
                    </button>
                  )}
                </p>
              ) : (
                <p className="movie-detail-empty-info">Chưa có nội dung.</p>
              )}
            </section>

            <section className="movie-detail-section movie-detail-info-block">
              <h2 className="movie-detail-section-title">THÔNG TIN CHI TIẾT</h2>
              <dl className="movie-detail-info-list">
                {movie.director && (
                  <>
                    <dt>ĐẠO DIỄN</dt>
                    <dd>{movie.director}</dd>
                  </>
                )}
                {durationPerEp && (
                  <>
                    <dt>THỜI LƯỢNG</dt>
                    <dd>{durationPerEp}</dd>
                  </>
                )}
                {movie.quality && (
                  <>
                    <dt>CHẤT LƯỢNG</dt>
                    <dd>{movie.quality}</dd>
                  </>
                )}
                {movie.language && (
                  <>
                    <dt>NGÔN NGỮ</dt>
                    <dd>{movie.language}</dd>
                  </>
                )}
                {movie.parts && movie.parts.length > 1 && (
                  <>
                    <dt>PHẦN</dt>
                    <dd>Phần {(movie.parts.find((p) => p.id === movie.id)?.part_number ?? movie.part_number ?? 1)}</dd>
                  </>
                )}
                {totalEps > 0 && (
                  <>
                    <dt>SỐ TẬP</dt>
                    <dd>Tập {episodeCurrent} / {totalEps}</dd>
                  </>
                )}
                {movie.country && (
                  <>
                    <dt>QUỐC GIA</dt>
                    <dd>{movie.country}</dd>
                  </>
                )}
                {movie.release_year && (
                  <>
                    <dt>NĂM</dt>
                    <dd>{movie.release_year}</dd>
                  </>
                )}
                {updatedAt && (
                  <>
                    <dt>CẬP NHẬT</dt>
                    <dd>{updatedAt}</dd>
                  </>
                )}
              </dl>
            </section>

            <section className="movie-detail-section movie-detail-actors-block">
              <h2 className="movie-detail-section-title">DIỄN VIÊN</h2>
              {Array.isArray(movie.cast) && movie.cast.length > 0 ? (
                <ul className="movie-detail-actors-list">
                  {movie.cast.map((p, i) => {
                    const name = (typeof p === 'object' && p && p.name ? p.name : p) || '';
                    if (!name) return null;
                    const actorSlug = slugify(name);
                    const avatarUrl = typeof p === 'object' && p && (p.avatar || p.photo) ? (p.avatar || p.photo) : null;
                    return (
                      <li key={`${actorSlug}-${i}`}>
                        <Link to={`/dien-vien/${actorSlug}`} className="movie-detail-actor-item">
                          <div className="movie-detail-actor-avatar">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="" loading="lazy" />
                            ) : (
                              <i className="fas fa-user" aria-hidden />
                            )}
                          </div>
                          <span>{name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="movie-detail-empty-info">Chưa có thông tin diễn viên.</p>
              )}
            </section>
          </div>

          {/* Cột phải: Danh sách tập, Bình luận */}
          <div className="movie-detail-body-right">
            {hasEpisodes && totalEps > 0 && (
              <section className="movie-detail-section movie-detail-episodes-block">
                <div className="movie-detail-episodes-header">
                  <h2 className="movie-detail-section-title movie-detail-episodes-title">
                    <i className="fas fa-tv" aria-hidden /> Danh sách tập phim
                  </h2>
                  {uniqueServers.length > 0 && (
                    <div className="movie-detail-server-pills" role="tablist" aria-label="Chọn server">
                      {uniqueServers.map((u) => (
                        <button
                          key={u.index}
                          type="button"
                          role="tab"
                          aria-selected={selectedServerIndex === u.index}
                          className={`movie-detail-server-pill${selectedServerIndex === u.index ? ' active' : ''}`}
                          onClick={() => setSelectedServerIndex(u.index)}
                        >
                          #{u.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="movie-detail-episodes-list">
                  {isPhimLe ? (
                    <Link to={`/watch/${movie.id}${uniqueServers.length > 0 ? `?server=${selectedServerIndex}` : ''}`} className="movie-detail-ep-btn active">
                      <i className="fas fa-play" aria-hidden /> Full
                    </Link>
                  ) : (
                    Array.from({ length: episodesToShow }, (_, i) => i + 1).map((ep) => (
                      <Link
                        key={ep}
                        to={`/watch/${movie.id}?ep=${ep}${uniqueServers.length > 0 ? `&server=${selectedServerIndex}` : ''}`}
                        className={`movie-detail-ep-btn${episodeCurrent === ep ? ' active' : ''}`}
                      >
                        Tập {String(ep).padStart(2, '0')}
                      </Link>
                    ))
                  )}
                </div>
              </section>
            )}

            <section id="movie-detail-comments" className="movie-detail-section movie-detail-comments">
              <h2 className="movie-detail-section-title">
                <i className="fas fa-comments" aria-hidden /> Bình luận ({comments.filter((c) => !c.parent_id).length})
              </h2>
              {user ? (
                <form className="movie-detail-comment-form" onSubmit={handleSubmitComment}>
                  {replyToCommentId && (
                    <p className="movie-detail-comment-reply-hint">
                      Đang trả lời bình luận
                      <button type="button" className="link-button" onClick={() => setReplyToCommentId(null)}>Hủy</button>
                    </p>
                  )}
                  <div className="movie-detail-comment-form-row">
                    <div className="movie-detail-comment-form-avatar" aria-hidden="true">
                      {user?.avatar ? <img src={imageDisplayUrl(user.avatar)} alt="" /> : <span>{user?.name?.charAt(0)?.toUpperCase() || '?'}</span>}
                    </div>
                    <div className="movie-detail-comment-form-body">
                      <CommentInputWithEmoji
                        value={commentText}
                        onChange={setCommentText}
                        inputClassName="movie-detail-comment-input"
                        placeholder="Viết bình luận..."
                        rows={3}
                        maxLength={500}
                      />
                      <div className="movie-detail-comment-form-actions">
                        <div className="movie-detail-comment-form-actions-left">
                          <span className="movie-detail-comment-char-count">{commentText.length}/500</span>
                          <label className="movie-detail-comment-spoiler-label">
                            <input
                              type="checkbox"
                              checked={commentSpoiler}
                              onChange={(e) => setCommentSpoiler(e.target.checked)}
                            />
                            <i className="fas fa-triangle-exclamation" aria-hidden />
                            <span>Cảnh báo Spoiler</span>
                          </label>
                        </div>
                        <button type="submit" className="movie-detail-comment-submit" disabled={!commentText.trim() || commentSubmitting}>
                          <i className="fas fa-paper-plane" aria-hidden /> {commentSubmitting ? 'Đang gửi...' : 'Gửi'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                <p className="movie-detail-login-prompt">
                  <i className="fas fa-user" aria-hidden /> <button type="button" className="link-button" onClick={openLoginModal}>Đăng nhập</button> để bình luận.
                </p>
              )}
              <ul className="movie-detail-comment-list">
            {comments.length === 0 ? (
              <li className="movie-detail-comment-empty">
                <i className="fas fa-comment" aria-hidden />
                Chưa có bình luận nào. Hãy là người đầu tiên!
              </li>
            ) : (() => {
              const roots = comments.filter((c) => !c.parent_id);
              const repliesByParent = {};
              comments.forEach((c) => {
                if (c.parent_id) {
                  if (!repliesByParent[c.parent_id]) repliesByParent[c.parent_id] = [];
                  repliesByParent[c.parent_id].push(c);
                }
              });
              const renderCommentItem = (c) => (
                <>
                  <div className="movie-detail-comment-avatar">
                    {(c.user_avatar && <img src={imageDisplayUrl(c.user_avatar)} alt="" />) || (
                      <span>{c.user_name?.charAt(0)?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <div className="movie-detail-comment-body">
                    <div className="movie-detail-comment-head">
                      <span className="movie-detail-comment-author">{c.user_name}</span>
                      {c.is_spoiler && <span className="movie-detail-comment-spoiler-badge">SPOILER</span>}
                      <span className="movie-detail-comment-time">{formatRelativeTimeGMT7(c.created_at)}</span>
                      {user && c.user_id === user.id && (
                        <CommentActions
                          commentId={c.id}
                          isOwn
                          onEdit={() => handleEditComment(c)}
                          onDelete={() => handleDeleteComment(c.id)}
                          onReport={null}
                          reportDisabled={false}
                        />
                      )}
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="movie-detail-comment-edit">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="movie-detail-comment-input"
                          rows={3}
                          maxLength={500}
                          autoFocus
                        />
                        <div className="movie-detail-comment-edit-actions">
                          <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={!editContent.trim() || editSubmitting}>
                            {editSubmitting ? 'Đang lưu...' : 'Lưu'}
                          </button>
                          <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} disabled={editSubmitting}>
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : c.is_spoiler && !spoilerRevealedIds.has(c.id) ? (
                      <button
                        type="button"
                        className="movie-detail-comment-spoiler-reveal"
                        onClick={() => setSpoilerRevealedIds((prev) => new Set(prev).add(c.id))}
                      >
                        Bấm để xem nội dung
                      </button>
                    ) : (
                      <p className="movie-detail-comment-content">{c.content}</p>
                    )}
                    <div className="movie-detail-comment-footer">
                      <button
                        type="button"
                        className={`movie-detail-comment-like ${c.user_liked ? 'liked' : ''}`}
                        onClick={() => handleLikeComment(c.id)}
                      >
                        <i className="fas fa-thumbs-up" />
                        <span>{c.like_count ?? 0}</span>
                      </button>
                      <button
                        type="button"
                        className="movie-detail-comment-reply-btn"
                        onClick={() => setReplyToCommentId(c.id)}
                      >
                        <i className="fas fa-reply" />
                        Trả lời
                      </button>
                      {user && (
                        <button
                          type="button"
                          className="movie-detail-comment-report-btn"
                          onClick={() => handleReportComment(c.id)}
                          disabled={reportedCommentIds.has(c.id)}
                          title="Báo cáo"
                        >
                          <i className="fas fa-flag" />
                          {reportedCommentIds.has(c.id) ? 'Đã báo cáo' : 'Báo cáo'}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
              return roots.map((root) => {
                const replies = repliesByParent[root.id] || [];
                return (
                  <li key={root.id} className="movie-detail-comment-item">
                    <div className="movie-detail-comment-root-inner">
                      {renderCommentItem(root)}
                    </div>
                    {replies.length > 0 && (
                      <div className="movie-detail-comment-replies-wrap">
                        {repliesExpanded.has(root.id) ? (
                          <>
                            <button
                              type="button"
                              className="movie-detail-comment-replies-toggle"
                              onClick={() => setRepliesExpanded((prev) => { const n = new Set(prev); n.delete(root.id); return n; })}
                            >
                              <i className="fas fa-chevron-up" aria-hidden /> Ấn phản hồi
                            </button>
                            <ul className="movie-detail-comment-replies">
                              {replies.map((reply) => (
                                <li key={reply.id} className="movie-detail-comment-item is-reply">
                                  {renderCommentItem(reply)}
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="movie-detail-comment-replies-toggle"
                            onClick={() => setRepliesExpanded((prev) => new Set(prev).add(root.id))}
                          >
                            <i className="fas fa-chevron-down" aria-hidden /> Xem {replies.length} phản hồi
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              });
            })()}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
