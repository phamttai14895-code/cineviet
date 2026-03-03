import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { movies as moviesApi, settings as settingsApi, user as userApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../utils/imageUrl.js';
import { slugify } from '../utils/slugify.js';
import { toTitleCase } from '../utils/titleCase.js';
import VideoPlayer, { formatTime } from '../components/VideoPlayer';
import { formatRelativeTimeGMT7 } from '../utils/dateGMT7.js';
import CommentActions from '../components/CommentActions';
import CommentInputWithEmoji from '../components/CommentInputWithEmoji';
import TrailerModal from '../components/TrailerModal';
import WatchLoginBanner from '../components/WatchLoginBanner';
import WatchRateBanner from '../components/WatchRateBanner';
import { useSeo } from '../hooks/useSeo.js';
import { usePublicSettings } from '../context/PublicSettingsContext';

export default function Watch() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, openLoginModal } = useAuth();
  const { toast } = useToast();
  const [movie, setMovie] = useState(null);
  const [progress, setProgress] = useState(0);
  const [savedProgressPct, setSavedProgressPct] = useState(null);
  const [savedPositionSeconds, setSavedPositionSeconds] = useState(null);
  const [requireLogin, setRequireLogin] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [vastPrerollUrl, setVastPrerollUrl] = useState('');
  const [vastSkipOffsetSeconds, setVastSkipOffsetSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [toggleRapPhim, setToggleRapPhim] = useState(false);
  const [autoNextEpisode, setAutoNextEpisode] = useState(true);
  const [shareDone, setShareDone] = useState(false);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [currentServerIndex, setCurrentServerIndex] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentSpoiler, setCommentSpoiler] = useState(false);
  const [replyToCommentId, setReplyToCommentId] = useState(null);
  const [spoilerRevealedIds, setSpoilerRevealedIds] = useState(new Set());
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [reportedCommentIds, setReportedCommentIds] = useState(new Set());
  const [videoError, setVideoError] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [skipRippleSide, setSkipRippleSide] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState('video_error');
  const [reportMessage, setReportMessage] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');
  const [episodesListOpen, setEpisodesListOpen] = useState(true);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const seoImage = !movie ? undefined : (() => {
    const raw = movie.backdrop || movie.poster;
    if (!raw) return undefined;
    const d = imageDisplayUrl(raw);
    if (!d) return undefined;
    return d.startsWith('http') ? d : (typeof window !== 'undefined' ? window.location.origin + (d.startsWith('/') ? d : '/' + d) : '');
  })();
  useSeo(movie?.title, movie?.overview, seoImage);
  const publicSettings = usePublicSettings();
  const watchNotice = (publicSettings?.watch_notice || '').trim();
  const containerRef = useRef(null);
  const controlsHideRef = useRef(null);
  const reportTimeoutRef = useRef(null);
  const shortcutsTimerRef = useRef(null);
  const lastAutoNextEpisodeRef = useRef(null);
  const lastAutoNextTimeRef = useRef(0);
  const [nextEpisodeOverlay, setNextEpisodeOverlay] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const skipAutoNextThisEpisodeRef = useRef(false);
  const overlayShownThisEpisodeRef = useRef(false);
  const autoPlayNextRef = useRef(false);
  const progressAppliedForMovieIdRef = useRef(null);
  const hasSyncedEpisodeFromUrlRef = useRef(false);
  const lastWatchStateRef = useRef({ currentTime: 0, duration: 0, movieId: null, episode: 1 });
  const savedProgressPctRef = useRef(null);
  const continueToastShownRef = useRef(false);
  const [resumeHintVisible, setResumeHintVisible] = useState(true);
  const [loginBannerDismissed, setLoginBannerDismissed] = useState(false);
  const [rateBannerOpen, setRateBannerOpen] = useState(false);

  useEffect(() => {
    settingsApi.getPublic().then((r) => {
      const d = r.data || {};
      setRequireLogin(!!d.require_login);
      const vastEnabled = d.vast_enabled !== false && d.vast_enabled !== '0';
      setVastPrerollUrl(vastEnabled ? (d.vast_preroll_url || '').trim() : '');
      setVastSkipOffsetSeconds(Math.max(0, parseInt(d.vast_skip_offset_seconds, 10) || 0));
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    moviesApi.get(id).then((r) => setMovie(r.data)).catch(() => setMovie(null));
    setEpisodeSearchQuery('');
    setProgressLoaded(false);
    continueToastShownRef.current = false;
    savedProgressPctRef.current = null;
    setResumeHintVisible(true);
  }, [id]);

  useEffect(() => {
    setVideoError(false);
  }, [movie?.id]);

  // Khi đổi phim: lấy tập và server từ URL (?ep=3&server=0) nếu hợp lệ
  useEffect(() => {
    hasSyncedEpisodeFromUrlRef.current = false;
    setBufferedEnd(0);
    progressAppliedForMovieIdRef.current = null;
    if (!movie?.id) return;
    const epFromUrl = parseInt(searchParams.get('ep'), 10);
    const maxEp = (movie.total_episodes > 0) ? movie.total_episodes : 1;
    const validEp = Number.isFinite(epFromUrl) && epFromUrl >= 1 && epFromUrl <= maxEp;
    setCurrentEpisode(validEp ? epFromUrl : 1);
    const serverFromUrl = parseInt(searchParams.get('server'), 10);
    const maxServer = (movie.episodes && movie.episodes.length) ? movie.episodes.length : 0;
    if (Number.isFinite(serverFromUrl) && serverFromUrl >= 0 && serverFromUrl < maxServer) {
      setCurrentServerIndex(serverFromUrl);
    } else {
      setCurrentServerIndex(0);
    }
    hasSyncedEpisodeFromUrlRef.current = true;
  }, [movie?.id, movie?.total_episodes, movie?.episodes]);

  // Đồng bộ tập hiện tại lên URL để refresh không mất tập
  useEffect(() => {
    if (!hasSyncedEpisodeFromUrlRef.current || !movie?.id || currentEpisode < 1) return;
    const epInUrl = parseInt(searchParams.get('ep'), 10);
    if (epInUrl === currentEpisode) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('ep', String(currentEpisode));
      return next;
    }, { replace: true });
  }, [movie?.id, currentEpisode, setSearchParams]);

  useEffect(() => {
    if (!movie?.episodes?.length) return;
    const epIdx = Math.max(0, (currentEpisode || 1) - 1);
    const getLink = (s) => s?.server_data?.[epIdx] || s?.server_data?.[String(epIdx + 1)] || s?.server_data?.[String(currentEpisode)];
    const hasM3u8Link = (s) => {
      const link = getLink(s);
      return link && (link.link_m3u8 || '').trim();
    };
    const hasM3u8 = (i) => (getLink(movie.episodes[i])?.link_m3u8 || '').trim().length > 0;
    const visible = movie.episodes.map((_, i) => i).filter((i) => hasM3u8Link(movie.episodes[i]));
    if (visible.length && !visible.includes(currentServerIndex)) {
      const preferred = visible.find(hasM3u8) ?? visible[0];
      setCurrentServerIndex(preferred);
    }
    // Không reset về tập 1 khi không có link — tránh ghi đè khi user chọn tập khác
  }, [movie?.id, movie?.episodes, currentEpisode]);

  useEffect(() => {
    if (!movie?.id) return;
    moviesApi.comments(movie.id).then((r) => setComments(r.data || [])).catch(() => setComments([]));
  }, [movie?.id]);

  useEffect(() => {
    if (!user || !movie) return;
    userApi.favoriteIds().then((r) => setFavorited(r.data?.includes(movie.id))).catch(() => {});
  }, [user, movie?.id]);

  // Đồng bộ đa thiết bị: tải tiến độ + tập đã lưu (chỉ áp dụng 1 lần / phim để không ghi đè khi user chọn tập)
  useEffect(() => {
    if (!user || !movie?.id) {
      setProgressLoaded(true);
      return;
    }
    setProgressLoaded(false);
    const movieId = movie.id;
    userApi.progress(movieId).then((r) => {
      const pct = r.data?.progress ?? 0;
      const posSec = r.data?.position_seconds != null && Number.isFinite(Number(r.data.position_seconds)) ? Number(r.data.position_seconds) : null;
      setSavedProgressPct(pct);
      setSavedPositionSeconds(posSec);
      savedProgressPctRef.current = pct;
      if (progressAppliedForMovieIdRef.current === movieId) {
        setProgressLoaded(true);
        return;
      }
      progressAppliedForMovieIdRef.current = movieId;
      const ep = Math.max(1, parseInt(r.data?.episode, 10) || 1);
      const maxEp = movie.total_episodes > 0 ? movie.total_episodes : 1;
      setCurrentEpisode((prev) => (prev === 1 ? Math.min(maxEp, ep) : prev));
      setProgressLoaded(true);
    }).catch(() => {
      setSavedProgressPct(0);
      setSavedPositionSeconds(null);
      savedProgressPctRef.current = 0;
      setProgressLoaded(true);
    });
  }, [user, movie?.id, movie?.total_episodes]);

  useEffect(() => {
    if (!user) return;
    userApi.reportedCommentIds().then((r) => setReportedCommentIds(new Set(r.data?.comment_ids || []))).catch(() => setReportedCommentIds(new Set()));
  }, [user]);

  // Cập nhật ref để lưu khi thoát trang / unmount
  useEffect(() => {
    lastWatchStateRef.current = {
      currentTime,
      duration,
      movieId: movie?.id ?? null,
      episode: currentEpisode,
    };
  }, [currentTime, duration, movie?.id, currentEpisode]);

  const saveProgressToServer = useCallback((opts = {}) => {
    const { currentTime: t = lastWatchStateRef.current.currentTime, duration: d = lastWatchStateRef.current.duration, movieId: mid = lastWatchStateRef.current.movieId, episode: ep = lastWatchStateRef.current.episode } = opts;
    if (!user || !mid) return;
    if (!Number.isFinite(d) || d <= 0) return;
    const p = Math.min(100, Math.max(0, Math.round((t / d) * 100)));
    if (p === 0 && t === 0 && savedProgressPctRef.current != null && savedProgressPctRef.current > 0) return;
    const positionSeconds = Math.max(0, Math.round(t));
    moviesApi.watch(mid, { progress: p, completed: p >= 90 ? 1 : 0, episode: ep, position_seconds: positionSeconds }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user || !movie) return;
    const report = () => {
      if (!Number.isFinite(duration) || duration <= 0) return;
      const p = Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));
      setProgress(p);
      if (p === 0 && currentTime === 0 && savedProgressPct != null && savedProgressPct > 0) return;
      saveProgressToServer({ currentTime, duration, movieId: movie.id, episode: currentEpisode });
    };
    report();
    const interval = 5000;
    reportTimeoutRef.current = setInterval(report, interval);
    return () => {
      clearInterval(reportTimeoutRef.current);
      saveProgressToServer();
    };
  }, [user, movie?.id, currentTime, duration, currentEpisode, savedProgressPct, saveProgressToServer]);

  useEffect(() => {
    const onLeave = () => {
      const { movieId, currentTime, duration, episode } = lastWatchStateRef.current;
      if (!movieId || !Number.isFinite(duration) || duration <= 0) return;
      const p = Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));
      if (p === 0 && currentTime === 0 && savedProgressPctRef.current != null && savedProgressPctRef.current > 0) return;
      const token = localStorage.getItem('token');
      if (!token) return;
      const positionSeconds = Math.max(0, Math.round(currentTime));
      fetch(`/api/movies/${movieId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ progress: p, completed: p >= 90 ? 1 : 0, episode, position_seconds: positionSeconds }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', onLeave);
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveProgressToServer();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [saveProgressToServer]);

  // Reset guard khi đổi tập; sau khi đã dùng autoPlay cho tập mới thì tắt ref
  useEffect(() => {
    lastAutoNextEpisodeRef.current = null;
    overlayShownThisEpisodeRef.current = false;
    skipAutoNextThisEpisodeRef.current = false;
    setNextEpisodeOverlay(false);
    if (autoPlayNextRef.current) autoPlayNextRef.current = false;
  }, [currentEpisode]);

  const goToNextEpisode = useCallback(() => {
    if (!movie) return;
    const isSeriesType = movie.type === 'series' || movie.type === 'anime';
    const total = isSeriesType && movie.total_episodes > 0 ? movie.total_episodes : 1;
    if (currentEpisode >= total) return;
    if (lastAutoNextEpisodeRef.current === currentEpisode) return;
    lastAutoNextEpisodeRef.current = currentEpisode;
    lastAutoNextTimeRef.current = Date.now();
    autoPlayNextRef.current = true;
    setCurrentEpisode((prev) => prev + 1);
    toast.info('Đang chuyển sang tập tiếp theo...');
  }, [movie, currentEpisode, toast]);

  const totalEpisodes = (movie?.type === 'series' || movie?.type === 'anime') && movie?.total_episodes > 0 ? movie.total_episodes : 1;
  const hasNextEpisode = (movie?.type === 'series' || movie?.type === 'anime') && currentEpisode < totalEpisodes;

  // --- Chức năng chuyển tập (M3U8: dùng duration, fallback bufferedEnd) ---
  const effectiveEnd = (Number.isFinite(duration) && duration > 0) ? duration : (Number.isFinite(bufferedEnd) && bufferedEnd > 0 ? bufferedEnd : 0);
  const remaining = isAdPlaying ? Infinity : (effectiveEnd >= 10 ? Math.max(0, effectiveEnd - currentTime) : Infinity);
  const nearEnd = remaining <= 30;
  const showNextOverlay = !isAdPlaying && effectiveEnd >= 10 && remaining <= 90;

  useEffect(() => {
    if (!autoNextEpisode || !hasNextEpisode || !showNextOverlay || skipAutoNextThisEpisodeRef.current) return;
    if (!overlayShownThisEpisodeRef.current) {
      overlayShownThisEpisodeRef.current = true;
      setNextEpisodeCountdown(10);
      setNextEpisodeOverlay(true);
    }
  }, [autoNextEpisode, currentTime, effectiveEnd, showNextOverlay, hasNextEpisode]);

  useEffect(() => {
    if (!nextEpisodeOverlay) return;
    const t = setInterval(() => setNextEpisodeCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [nextEpisodeOverlay]);

  useEffect(() => {
    if (nextEpisodeOverlay && nextEpisodeCountdown === 0) {
      setNextEpisodeOverlay(false);
      goToNextEpisode();
    }
  }, [nextEpisodeOverlay, nextEpisodeCountdown, goToNextEpisode]);

  const handleNextEpisodeNow = useCallback(() => {
    setNextEpisodeOverlay(false);
    goToNextEpisode();
  }, [goToNextEpisode]);

  const handleCancelAutoNext = useCallback(() => {
    setNextEpisodeOverlay(false);
    skipAutoNextThisEpisodeRef.current = true;
  }, []);

  useEffect(() => {
    if (isAdPlaying || !autoNextEpisode || !hasNextEpisode || effectiveEnd < 10) return;
    if (Date.now() - lastAutoNextTimeRef.current < 5000) return;
    if (skipAutoNextThisEpisodeRef.current) return;
    if ((currentTime / effectiveEnd) >= 0.98) goToNextEpisode();
  }, [isAdPlaying, autoNextEpisode, currentTime, effectiveEnd, hasNextEpisode, goToNextEpisode]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: movie?.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShareDone(true);
      toast.success('Đã copy link!');
      setTimeout(() => setShareDone(false), 2000);
    } catch (e) {
      if (e.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url);
          setShareDone(true);
          setTimeout(() => setShareDone(false), 2000);
        } catch (_) {}
      }
    }
  }, [movie?.title, toast]);

  const handleFavorite = useCallback(async () => {
    if (!user || !movie) return;
    try {
      const { data } = await moviesApi.favorite(movie.id);
      setFavorited(data.favorited);
    } catch (_) {}
  }, [user, movie]);

  const handleRate = useCallback(async (rating) => {
    if (!user) {
      openLoginModal();
      return;
    }
    try {
      const { data } = await moviesApi.rate(movie.id, rating);
      setUserRating(rating);
      if (data?.rating != null) setMovie((m) => ({ ...m, rating: Math.round(Number(data.rating) * 10) / 10 }));
      else {
        const avg = (movie?.rating ?? 0) ? ((movie.rating + rating) / 2) : rating;
        setMovie((m) => ({ ...m, rating: Math.round(avg * 10) / 10 }));
      }
    } catch (err) {
      console.error(err);
    }
  }, [user, movie, openLoginModal]);

  const handleRatedFromBanner = useCallback((rating, newAverage) => {
    setUserRating(rating);
    if (newAverage != null) setMovie((m) => ({ ...m, rating: Math.round(Number(newAverage) * 10) / 10 }));
  }, []);

  const handleReportComment = useCallback(async (commentId) => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (reportedCommentIds.has(commentId)) return;
    try {
      await userApi.reportComment(commentId);
      setReportedCommentIds((prev) => new Set(prev).add(commentId));
    } catch (err) {
      console.error(err);
    }
  }, [user, openLoginModal]);

  const handleLikeComment = useCallback(async (commentId) => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (!movie) return;
    try {
      const { data } = await moviesApi.likeComment(movie.id, commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, user_liked: data.liked, like_count: data.like_count } : c
        )
      );
    } catch (err) {
      console.error(err);
    }
  }, [user, movie, openLoginModal]);

  const handleSubmitComment = useCallback(async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || !user || !movie) return;
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
    } catch (err) {
      console.error(err);
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentText, commentSpoiler, replyToCommentId, user, movie]);

  const handleEditComment = useCallback((c) => {
    setEditingCommentId(c.id);
    setEditContent(c.content || '');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingCommentId == null || !editContent.trim() || !movie) return;
    setEditSubmitting(true);
    try {
      const { data } = await moviesApi.updateComment(movie.id, editingCommentId, editContent.trim());
      setComments((prev) => prev.map((x) => (x.id === editingCommentId ? data : x)));
      setEditingCommentId(null);
      setEditContent('');
    } catch (err) {
      console.error(err);
    } finally {
      setEditSubmitting(false);
    }
  }, [movie, editingCommentId, editContent]);

  const handleCancelEdit = useCallback(() => {
    setEditingCommentId(null);
    setEditContent('');
  }, []);

  const handleDeleteComment = useCallback(async (commentId) => {
    if (!window.confirm('Bạn có chắc muốn xóa bình luận này?')) return;
    if (!movie) return;
    try {
      await moviesApi.deleteComment(movie.id, commentId);
      setComments((prev) => prev.filter((x) => x.id !== commentId));
      toast.success('Đã xóa bình luận.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Không thể xóa bình luận');
    }
  }, [movie, toast]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onMove = () => {
      setShowControls(true);
      if (controlsHideRef.current) clearTimeout(controlsHideRef.current);
      controlsHideRef.current = setTimeout(() => setShowControls(false), 3000);
    };
    const onLeave = () => setShowControls(false);
    c.addEventListener('mousemove', onMove);
    c.addEventListener('mouseleave', onLeave);
    return () => {
      c.removeEventListener('mousemove', onMove);
      c.removeEventListener('mouseleave', onLeave);
      if (controlsHideRef.current) clearTimeout(controlsHideRef.current);
    };
  }, [movie?.id]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if ([' ', 'ArrowLeft', 'ArrowRight', 'f', 'F', 'm', 'M', 'p', 'P', 'c', 'C'].includes(e.key)) {
        setShortcutsVisible(true);
        if (shortcutsTimerRef.current) clearTimeout(shortcutsTimerRef.current);
        shortcutsTimerRef.current = setTimeout(() => setShortcutsVisible(false), 2500);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /* Không tự mở modal đăng nhập; dùng banner trượt từ dưới lên để mời đăng nhập */

  const handleContainerDblClick = useCallback(() => {
    if (!document.querySelector('.watch-iframe')) {
      const el = containerRef.current;
      if (el && !document.fullscreenElement) el.requestFullscreen?.();
      else if (document.fullscreenElement) document.exitFullscreen?.();
    }
  }, []);

  const servers = Array.isArray(movie?.episodes) ? movie.episodes : [];
  const episodeIndex = Math.max(0, (currentEpisode || 1) - 1);
  // Hỗ trợ cả server_data dạng mảng (0-based) và object key "1","2",... (1-based)
  // Chỉ lấy link m3u8 để phát, không phát link embed
  const getEpisodeLinkFrom = (data) => {
    if (!data) return null;
    const link = data[episodeIndex] || data[String(currentEpisode)] || data[currentEpisode];
    return link && (link.link_m3u8 || '').trim() ? link : null;
  };
  const hasM3u8ForEpisode = (s) => (getEpisodeLinkFrom(s?.server_data)?.link_m3u8 || '').trim().length > 0;
  const hasLinkForEpisode = (s) => !!getEpisodeLinkFrom(s?.server_data);
  // Chỉ server có ít nhất một tập có link m3u8 (để hiện trong dropdown và phát)
  const allServerIndices = servers
    .map((_, i) => i)
    .filter((i) => {
      const data = servers[i]?.server_data || [];
      return data.some((d) => d && (d.link_m3u8 || '').trim());
    });
  // Server có link cho tập hiện tại — ưu tiên server có M3U8 lên trước
  const visibleServerIndices = servers
    .map((_, i) => i)
    .filter((i) => hasLinkForEpisode(servers[i]))
    .sort((a, b) => (hasM3u8ForEpisode(servers[b]) ? 1 : 0) - (hasM3u8ForEpisode(servers[a]) ? 1 : 0));
  const effectiveServerIndex = visibleServerIndices.includes(currentServerIndex)
    ? currentServerIndex
    : (visibleServerIndices[0] ?? currentServerIndex);

  const currentServer = servers[effectiveServerIndex];
  const serverData = currentServer?.server_data || [];
  const episodeLink = getEpisodeLinkFrom(serverData);
  const videoUrlFromEpisodes = (episodeLink?.link_m3u8 || '').trim();
  const videoUrl = videoUrlFromEpisodes || (movie?.video_url && /\.m3u8|\.mp4|m3u8|webm|ogg|mov/i.test(movie.video_url) ? movie.video_url.trim() : '') || movie?.trailer_url || '';

  const serverDisplayName = (name) => (name || '')
    .replace(/\s*\[SV\s*#\d+\]\s*/gi, ' ')
    .replace(/\s*\[(Ophim|PhimAPI|Nguonc)\]\s*/gi, ' ')
    .replace(/\s*(Ophim|PhimAPI|Nguonc)\s*[-–]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || name || 'Nguồn';
  const poster = imageDisplayUrl(movie?.backdrop || movie?.poster) || NO_POSTER_DATA_URL;
  const onPosterError = (e) => {
    if (e.target.src !== NO_POSTER_DATA_URL) {
      e.target.onerror = null;
      e.target.src = NO_POSTER_DATA_URL;
    }
  };
  const isSeries = movie?.type === 'series' || movie?.type === 'anime';
  const isPhimLe = !isSeries && (movie?.type === 'movie' || (movie?.total_episodes || 0) <= 1);

  const totalEpsForAired = (movie?.total_episodes && movie.total_episodes > 0) ? movie.total_episodes : 1;
  let latestAiredEpisode = 0;
  for (let ep = 1; ep <= totalEpsForAired; ep++) {
    const hasLink = servers.some((s) => {
      const data = s?.server_data || [];
      const link = data[ep - 1] || data[String(ep)] || data[ep];
      return link && (link.link_m3u8 || '').trim();
    });
    if (hasLink) latestAiredEpisode = ep;
  }

  const playerSources =
    visibleServerIndices.length > 0
      ? visibleServerIndices
          .map((i) => {
            const data = servers[i].server_data || [];
            const link = getEpisodeLinkFrom(data);
            const m3u8 = (link?.link_m3u8 || '').trim();
            return {
              label: serverDisplayName(servers[i].server_name) || `Server ${i + 1}`,
              url: m3u8,
            };
          })
          .filter((s) => s.url)
      : videoUrl
        ? [{ label: 'Nguồn', url: videoUrl }]
        : [];
  const playerSelectedIndex = playerSources.length ? Math.max(0, visibleServerIndices.indexOf(effectiveServerIndex)) : 0;
  const initialTimeSeconds =
    savedPositionSeconds != null && Number.isFinite(savedPositionSeconds) && savedPositionSeconds > 0
      ? Math.max(0, savedPositionSeconds)
      : savedProgressPct != null && savedProgressPct > 0 && movie?.duration
        ? Math.max(0, (savedProgressPct / 100) * (movie.duration * 60))
        : 0;

  // Modal Tiếp tục xem chỉ đóng khi user bấm "Tiếp tục xem" hoặc "Xem lại từ đầu"

  // Chỉ dùng iframe khi URL thực sự là embed (không phải M3U8/MP4). Lỗi phát không chuyển sang iframe để giữ VAST + chuyển tập.
  const isDirectVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const u = url.toLowerCase().split('?')[0];
    return /\.(mp4|m3u8|webm|ogg|mov)(\?|$)/i.test(u) || url.includes('m3u8');
  };
  const useIframe = videoUrl && !isDirectVideoUrl(videoUrl);

  const handleOpenReportModal = useCallback(() => {
    if (!user) {
      openLoginModal();
      return;
    }
    setReportType('video_error');
    setReportMessage('');
    setReportModalOpen(true);
  }, [user, openLoginModal]);

  const handleSubmitReport = useCallback(async (e) => {
    e.preventDefault();
    if (!movie || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await userApi.reportWatch({
        movie_id: movie.id,
        episode: currentEpisode,
        report_type: reportType,
        message: reportMessage.trim() || undefined,
      });
      toast.success('Đã gửi báo cáo. Cảm ơn bạn đã phản hồi!');
      setReportModalOpen(false);
      setReportMessage('');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Gửi báo cáo thất bại.');
    } finally {
      setReportSubmitting(false);
    }
  }, [movie, currentEpisode, reportType, reportMessage, reportSubmitting, toast]);

  const handleOpenWatchParty = useCallback(() => {
    const m3u8FromEpisode = (episodeLink?.link_m3u8 || '').trim();
    const directMovieUrl = movie?.video_url && isDirectVideoUrl(movie.video_url)
      ? movie.video_url.trim()
      : '';
    const preferredUrl = m3u8FromEpisode || directMovieUrl;

    if (!preferredUrl) {
      toast.info('Phim này chỉ có link embed, không hỗ trợ Xem chung đồng bộ. Vui lòng thêm link M3U8 hoặc MP4 trong Admin.');
      return;
    }

    navigate('/xem-chung', {
      state: {
        prefillVideoUrl: preferredUrl,
        prefillMovieTitle: movie?.title || '',
        prefillHostName: user?.name ?? '',
      },
    });
  }, [episodeLink, movie?.video_url, movie?.title, navigate, toast, isDirectVideoUrl, user?.name]);

  if (!movie) return <div className="container loading-wrap">Đang tải...</div>;

  const showLoginBanner = settingsLoaded && !authLoading && !user && !loginBannerDismissed;
  const blockVideoWhenRequireLogin = requireLogin && !user;

  return (
    <div className={`watch-page ${toggleRapPhim ? 'is-rap-phim' : ''}`}>
      {showLoginBanner && <WatchLoginBanner onDismiss={() => setLoginBannerDismissed(true)} />}
      <div className="watch-header">
        <Link to={`/movie/${movie.id}`} className="watch-back-link">← Quay lại</Link>
        <h1 className="watch-title">{toTitleCase(movie.title)}</h1>
      </div>

      {toggleRapPhim && (
        <div
          className="watch-rap-phim-overlay"
          aria-hidden="true"
          onClick={() => setToggleRapPhim(false)}
          onKeyDown={(e) => (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), setToggleRapPhim(false))}
          role="button"
          tabIndex={0}
          title="Bấm để tắt Rạp phim"
        />
      )}

      <div
        className={`watch-player-wrap ${showControls ? 'show-controls' : ''} ${fullscreen ? 'is-fullscreen' : ''} ${playing && !showControls ? 'hide-cursor' : ''}`}
        ref={containerRef}
        onDoubleClick={handleContainerDblClick}
      >
        <div className={`watch-player-container ${!playing ? 'paused' : ''}`}>
          {blockVideoWhenRequireLogin ? (
            <div className="watch-require-login-placeholder">
              <img src={poster} alt="" onError={onPosterError} />
              <p className="watch-require-login-placeholder-text">Đăng nhập để xem phim</p>
            </div>
          ) : videoUrl ? (
            (!user || progressLoaded) ? (
            <>
              {useIframe ? (
                <>
                  <iframe
                    key={videoUrl}
                    src={(() => {
                      try {
                        const u = new URL(videoUrl, window.location.href);
                        if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay', '1');
                        return u.toString();
                      } catch (_) {
                        return videoUrl + (videoUrl.includes('?') ? '&' : '?') + 'autoplay=1';
                      }
                    })()}
                    title="Xem phim"
                    className="watch-video-el watch-iframe"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  {resumeHintVisible && savedProgressPct != null && savedProgressPct > 0 && (
                    <div className="watch-resume-modal-overlay" role="dialog" aria-labelledby="watch-resume-modal-title-iframe" aria-modal="true">
                      <div className="watch-resume-modal-card">
                        <h2 id="watch-resume-modal-title-iframe" className="watch-resume-modal-title">THÔNG BÁO!</h2>
                        <p className="watch-resume-modal-message">
                          <>Bạn đã dừng lại ở <span className="watch-resume-modal-time">{Math.floor(initialTimeSeconds / 60)} phút {Math.floor(initialTimeSeconds % 60)} giây</span></>
                        </p>
                        <div className="watch-resume-modal-actions">
                          <button type="button" className="watch-resume-modal-btn watch-resume-modal-continue" onClick={() => setResumeHintVisible(false)}>
                            Tiếp tục xem
                          </button>
                          <button type="button" className="watch-resume-modal-btn watch-resume-modal-startover" onClick={() => setResumeHintVisible(false)}>
                            Xem lại từ đầu
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <VideoPlayer
                  key={`ep-${currentEpisode}-${effectiveServerIndex}-${episodeIndex}`}
                  sources={playerSources}
                  sourceIndex={playerSelectedIndex}
                  onSourceIndexChange={(i) => setCurrentServerIndex(visibleServerIndices[i])}
                  poster={poster}
                  containerRef={containerRef}
                  initialTime={initialTimeSeconds}
                  subtitles={movie.subtitle_url ? [{ url: movie.subtitle_url.startsWith('http') ? movie.subtitle_url : (window.location.origin + (movie.subtitle_url.startsWith('/') ? '' : '/') + movie.subtitle_url), lang: 'vi', label: 'Tiếng Việt' }] : []}
                  autoPlay={autoPlayNextRef.current}
                  vastAdTagUrl={vastPrerollUrl}
                  adSkipOffsetSeconds={vastSkipOffsetSeconds}
                  onAdPlayingChange={setIsAdPlaying}
                  resumeHintVisible={resumeHintVisible && savedProgressPct != null && savedProgressPct > 0}
                  resumeHintSeconds={resumeHintVisible ? initialTimeSeconds : 0}
                  resumeHintHasProgress={savedProgressPct != null && savedProgressPct > 0}
                  resumeHintPct={savedProgressPct ?? 0}
                  onResumeHintContinue={() => setResumeHintVisible(false)}
                  onResumeHintStartOver={() => setResumeHintVisible(false)}
                  onTimeUpdate={(t, d) => {
                    setCurrentTime(t);
                    if (d != null && Number.isFinite(d) && d > 0) setDuration(d);
                  }}
                  onLoadedMetadata={(d) => {
                    if (d != null && Number.isFinite(d) && d > 0) setDuration(d);
                  }}
                  onDurationChange={(d) => {
                    if (d != null && Number.isFinite(d) && d > 0) setDuration(d);
                  }}
                  onBufferUpdate={(t, end, d) => {
                    if (end != null && Number.isFinite(end) && end > 0) setBufferedEnd(end);
                    if (d != null && Number.isFinite(d) && d > 0) setDuration(d);
                  }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => {
                    setPlaying(false);
                    saveProgressToServer();
                  }}
                  onEnded={() => { if (autoNextEpisode) goToNextEpisode(); }}
                  onError={() => setVideoError(true)}
                  onShortcutsHint={() => {
                    setShortcutsVisible(true);
                    if (shortcutsTimerRef.current) clearTimeout(shortcutsTimerRef.current);
                    shortcutsTimerRef.current = setTimeout(() => setShortcutsVisible(false), 2500);
                  }}
                />
              )}
              <div className="watch-player-overlay" />
              {/* Overlay auto chuyển tập: đếm ngược + nút Tập tiếp theo / Hủy (chỉ khi bật chức năng chuyển tập) */}
              {autoNextEpisode && nextEpisodeOverlay && hasNextEpisode && (
                <div className="watch-next-episode-overlay" role="dialog" aria-label="Tập tiếp theo">
                  <div className="watch-next-episode-card">
                    <p className="watch-next-episode-title">Tập tiếp theo</p>
                    <p className="watch-next-episode-countdown">Tự chuyển trong {nextEpisodeCountdown} giây</p>
                    <div className="watch-next-episode-actions">
                      <button type="button" className="btn btn-primary watch-next-episode-btn" onClick={handleNextEpisodeNow}>
                        <i className="fas fa-play" /> Phát tập {currentEpisode + 1}
                      </button>
                      <button type="button" className="btn btn-secondary watch-next-episode-cancel" onClick={handleCancelAutoNext}>
                        Hủy
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Nút Tập tiếp theo — hiện khi còn 30 giây (chỉ khi bật chức năng chuyển tập) */}
              {autoNextEpisode && hasNextEpisode && !nextEpisodeOverlay && nearEnd && (
                <button
                  type="button"
                  className="watch-float-next-btn"
                  onClick={handleNextEpisodeNow}
                  title={`Tập ${currentEpisode + 1}`}
                >
                  <i className="fas fa-forward" /> Tập {currentEpisode + 1}
                </button>
              )}
            </>
            ) : (
              <div className="watch-player-loading-progress">
                <img src={poster} alt="" className="watch-player-loading-poster" onError={(e) => { e.target.onerror = null; e.target.src = poster; }} />
                <p className="watch-player-loading-text"><i className="fas fa-spinner fa-spin" /> Đang tải tiến độ xem...</p>
              </div>
            )
          ) : (
            <div className="watch-no-video">
              <p>Chưa có link xem phim. Admin cần thêm video_url cho phim này.</p>
              {movie.trailer_url && (
                <button type="button" className="watch-trailer-popup-btn" onClick={() => setTrailerOpen(true)}>
                  <i className="fas fa-film" /> Xem trailer
                </button>
              )}
            </div>
          ) }
        </div>

        <div className="watch-action-bar">
          <button type="button" className={`watch-action-btn ${favorited ? 'active' : ''}`} onClick={handleFavorite} title="Yêu thích">
            <i className={favorited ? 'fas fa-heart' : 'far fa-heart'} /> Yêu thích
          </button>
          <div className="watch-action-toggle">
            <span>Rạp phim</span>
            <button type="button" className={`watch-toggle ${toggleRapPhim ? 'on' : ''}`} onClick={() => setToggleRapPhim(!toggleRapPhim)} aria-label="Rạp phim" title={toggleRapPhim ? 'Tắt chế độ rạp phim' : 'Bật chế độ rạp phim (ẩn nội dung bên dưới)'}>
              <span className="watch-toggle-knob" />
            </button>
          </div>
          {isSeries && (
            <div className="watch-action-toggle">
              <span>Chuyển tập</span>
              <button type="button" className={`watch-toggle ${autoNextEpisode ? 'on' : ''}`} onClick={() => setAutoNextEpisode((v) => !v)} aria-label="Tự động chuyển tập" title={autoNextEpisode ? 'Tắt tự động chuyển tập tiếp theo' : 'Bật tự động chuyển tập tiếp theo'}>
                <span className="watch-toggle-knob" />
              </button>
            </div>
          )}
          <button type="button" className="watch-action-btn" onClick={handleShare} title="Chia sẻ">
            <i className="fas fa-paper-plane" /> {shareDone ? 'Đã copy!' : 'Chia sẻ'}
          </button>
          <button
            type="button"
            className="watch-action-btn"
            title="Xem chung"
            onClick={handleOpenWatchParty}
          >
            <i className="fas fa-users" /> Xem chung
          </button>
          {movie?.trailer_url && (
            <button type="button" className="watch-action-btn" onClick={() => setTrailerOpen(true)} title="Xem trailer">
              <i className="fas fa-film" /> Trailer
            </button>
          )}
          <span className="watch-action-spacer" aria-hidden="true" />
          <button
            type="button"
            className="watch-action-btn watch-action-btn-rate"
            title="Đánh giá phim"
            onClick={() => setRateBannerOpen(true)}
            aria-label="Đánh giá phim"
          >
            <i className="fas fa-star" /> Đánh giá phim
          </button>
          <button type="button" className="watch-action-btn" onClick={handleOpenReportModal} title="Báo lỗi phát sóng">
            <i className="fas fa-flag" /> Báo lỗi
          </button>
        </div>
      </div>

      {/* Dòng thông báo giữa thanh nút (Yêu thích, Chuyển tập...) và thông tin phim — chỉ phim bộ, nội dung chỉnh trong Cài đặt Admin */}
      {isSeries && watchNotice && (
        <div className="watch-notice-bar" role="status">
          <i className="fas fa-info-circle watch-notice-icon" aria-hidden />
          <span className="watch-notice-text">{watchNotice}</span>
        </div>
      )}

      {/* Bên dưới thông báo: trái = Danh sách tập + Bình luận, phải = Poster + Thông tin phim */}
      <div className="watch-below">
        <div className="watch-below-layout">
          <div className="watch-below-left">
            {/* Danh sách tập — hàng ngang: trái = tiêu đề + mũi tên (click ẩn/hiện), phải = pills chọn server */}
            <section className={`watch-below-episodes ${!episodesListOpen ? 'watch-below-episodes--collapsed' : ''}`}>
              <div className="watch-below-episodes-header">
                <button
                  type="button"
                  className="watch-below-episodes-toggle"
                  onClick={() => setEpisodesListOpen((v) => !v)}
                  aria-expanded={episodesListOpen}
                  aria-controls="watch-episodes-list"
                >
                  <span className="watch-below-episodes-title">
                    <i className="fas fa-tv watch-below-episodes-title-icon" aria-hidden /> Danh sách tập
                    <i className={`fas fa-chevron-${episodesListOpen ? 'up' : 'down'} watch-below-episodes-arrow`} aria-hidden />
                  </span>
                </button>
                {allServerIndices.length > 1 ? (
                  <div className="watch-below-server-pills">
                    {allServerIndices.map((i) => (
                      <button
                        key={i}
                        type="button"
                        className={`watch-below-server-pill ${currentServerIndex === i ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentServerIndex(i);
                          const s = servers[i];
                          const data = s?.server_data || [];
                          if (!(data[episodeIndex] && (data[episodeIndex].link_m3u8 || '').trim()) && data.length > 0) setCurrentEpisode(1);
                        }}
                      >
                        <i className="fas fa-list watch-below-server-pill-icon" aria-hidden />
                        #{serverDisplayName(servers[i].server_name) || `Server ${i + 1}`}
                      </button>
                    ))}
                  </div>
                ) : allServerIndices.length === 1 ? (
                  <p className="watch-below-server-single">
                    <i className="fas fa-list watch-below-server-pill-icon" aria-hidden />
                    #{serverDisplayName(servers[allServerIndices[0]].server_name) || 'Nguồn mặc định'}
                  </p>
                ) : null}
              </div>
              <div id="watch-episodes-list" className="watch-below-episodes-body" hidden={!episodesListOpen}>
              {movie.parts && movie.parts.length > 1 && (
                <div className="watch-part-select-wrap">
                  <select
                    className="watch-part-select"
                    value={movie.id}
                    onChange={(e) => navigate(`/watch/${e.target.value}`)}
                    aria-label="Chọn phần phim"
                  >
                    {movie.parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        Phần {p.part_number}{p.title && p.title !== movie.title ? `: ${p.title.length > 25 ? toTitleCase(p.title.slice(0, 25)) + '…' : toTitleCase(p.title)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!isPhimLe && (
                <div className="watch-episode-search-wrap">
                  <input
                    type="text"
                    className="watch-episode-search-input"
                    placeholder="Tìm tập..."
                    value={episodeSearchQuery}
                    onChange={(e) => setEpisodeSearchQuery(e.target.value)}
                    aria-label="Tìm kiếm tập phim"
                  />
                  <i className="fas fa-search watch-episode-search-icon" aria-hidden="true" />
                </div>
              )}
              <div className="watch-episodes-grid">
                {isPhimLe ? (
                  <button type="button" className="watch-episode-btn active" aria-current="true">
                    <i className="fas fa-play" /> Full
                  </button>
                ) : (
                  (() => {
                    const allEps = Array.from({ length: latestAiredEpisode || 1 }, (_, i) => i + 1);
                    const q = (episodeSearchQuery || '').trim().replace(/\s+/g, ' ');
                    const filtered = q ? allEps.filter((ep) => String(ep).includes(q)) : allEps;
                    return filtered.map((ep) => (
                      <button
                        key={ep}
                        type="button"
                        className={`watch-episode-btn ${currentEpisode === ep ? 'active' : ''}`}
                        onClick={() => setCurrentEpisode(ep)}
                      >
                        {currentEpisode === ep && <i className="fas fa-play" aria-hidden />}
                        Tập {String(ep).padStart(2, '0')}
                      </button>
                    ));
                  })()
                )}
              </div>
              {!isPhimLe && episodeSearchQuery.trim() && (
                <p className="watch-episodes-search-hint">
                  {Array.from({ length: latestAiredEpisode || 1 }, (_, i) => i + 1).filter((ep) => String(ep).includes((episodeSearchQuery || '').trim())).length} tập khớp
                </p>
              )}
              </div>
            </section>

            {/* Bình luận */}
            <section id="comments" className="watch-below-comments">
              <h3 className="watch-below-comments-title">
                <i className="fas fa-comment" aria-hidden /> Bình luận
                <span className="watch-below-comments-count" aria-label={`${comments.length} bình luận`}>{comments.length}</span>
              </h3>
              {user ? (
                <form className="watch-below-comment-form" onSubmit={handleSubmitComment}>
                  <div className="watch-below-comment-form-row">
                    <div className="watch-below-comment-avatar">
                      {user.avatar ? <img src={imageDisplayUrl(user.avatar)} alt="" /> : <span>{user.name?.charAt(0)?.toUpperCase() || '?'}</span>}
                    </div>
                    <div className="watch-below-comment-form-body">
                      <CommentInputWithEmoji
                        value={commentText}
                        onChange={setCommentText}
                        inputClassName="watch-below-comment-input"
                        placeholder="Viết bình luận..."
                        rows={2}
                        maxLength={500}
                      />
                      <div className="watch-below-comment-form-footer">
                        <div className="watch-below-comment-form-footer-left">
                          <span className="watch-below-comment-counter">{commentText.length}/500</span>
                          <label className="movie-detail-comment-spoiler-label">
                            <input type="checkbox" checked={commentSpoiler} onChange={(e) => setCommentSpoiler(e.target.checked)} />
                            <i className="fas fa-triangle-exclamation" aria-hidden />
                            <span>Cảnh báo Spoiler</span>
                          </label>
                        </div>
                        <button type="submit" className="watch-below-comment-submit" disabled={!commentText.trim() || commentSubmitting}>
                          <i className="fas fa-paper-plane" aria-hidden /> {commentSubmitting ? 'Đang gửi...' : 'Gửi'}
                        </button>
                      </div>
                    </div>
                  </div>
                  {replyToCommentId && (
                      <p className="movie-detail-comment-reply-hint">
                        Đang trả lời bình luận
                        <button type="button" className="link-button" onClick={() => setReplyToCommentId(null)}>Hủy</button>
                      </p>
                    )}
                </form>
              ) : (
                <p className="movie-detail-login-prompt">
                  <button type="button" className="link-button" onClick={openLoginModal}>Đăng nhập</button> để bình luận.
                </p>
              )}
            <ul className="movie-detail-comment-list">
              {comments.length === 0 ? (
                <li className="watch-comments-empty" aria-live="polite">
                  <div className="watch-comments-empty-inner">
                    <i className="fas fa-comment watch-comments-empty-icon" aria-hidden />
                    <p className="watch-comments-empty-text">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
                  </div>
                </li>
              ) : (
                comments.map((c) => (
                  <li key={c.id} className={`movie-detail-comment-item ${c.parent_id ? 'is-reply' : ''}`}>
                    <div className="movie-detail-comment-avatar">
                      {(c.user_avatar && <img src={c.user_avatar} alt="" />) || (
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
                  </li>
                ))
              )}
            </ul>
            </section>
          </div>

          {/* Cột phải: poster + thông tin phim */}
          <aside className="watch-below-right">
            <div className="watch-below-poster-wrap">
              <img src={poster} alt="" className="watch-below-poster" onError={onPosterError} />
              <p className="watch-below-now-watching">
                Đang xem: {isPhimLe ? 'Full' : `Tập ${String(currentEpisode).padStart(2, '0')}`}
              </p>
            </div>
            <h2 className="watch-below-movie-title">{toTitleCase(movie.title)}</h2>
            <dl className="watch-below-details">
              {movie.director && (
                <>
                  <dt>ĐẠO DIỄN</dt>
                  <dd>{movie.director}</dd>
                </>
              )}
              {(movie.duration || (isSeries && movie.duration)) && (
                <>
                  <dt>THỜI LƯỢNG</dt>
                  <dd>{movie.duration ? `${movie.duration} phút/tập` : '—'}</dd>
                </>
              )}
              <dt>NGÔN NGỮ</dt>
              <dd>{movie.language || 'Vietsub + Thuyết Minh'}</dd>
              <dt>QUỐC GIA</dt>
              <dd>{movie.country || '—'}</dd>
              <dt>CHẤT LƯỢNG</dt>
              <dd>{movie.quality || 'FHD'}</dd>
              {movie.parts && movie.parts.length > 1 && (
                <>
                  <dt>PHẦN</dt>
                  <dd>Phần {(movie.parts.find((p) => p.id === movie.id)?.part_number ?? movie.part_number ?? 1)}</dd>
                </>
              )}
              <dt>TẬP</dt>
              <dd>
                {isPhimLe ? 'Full' : `Tập ${latestAiredEpisode} / ${totalEpsForAired}`}
              </dd>
            </dl>
          </aside>
        </div>
      </div>

      <div className={`watch-shortcuts-hint ${shortcutsVisible ? 'show' : ''}`}>
        <div className="watch-shortcut"><kbd>Space</kbd> Phát/Dừng</div>
        <div className="watch-shortcut"><kbd>←</kbd><kbd>→</kbd> ±10 giây</div>
        <div className="watch-shortcut"><kbd>F</kbd> Toàn màn hình</div>
        <div className="watch-shortcut"><kbd>M</kbd> Tắt tiếng</div>
        <div className="watch-shortcut"><kbd>P</kbd> PiP</div>
        <div className="watch-shortcut"><kbd>C</kbd> Phụ đề</div>
      </div>
      {/* Modal báo lỗi phát sóng */}
      {reportModalOpen && (
        <div className="modal-overlay" onClick={() => !reportSubmitting && setReportModalOpen(false)} role="presentation">
          <div className="modal watch-report-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
            <h2 id="report-modal-title" className="watch-report-modal-title">
              <i className="fas fa-flag" /> Báo lỗi phát sóng
            </h2>
            <p className="watch-report-modal-subtitle">
              Phim: {movie?.title ? toTitleCase(movie.title) : ''} — {isPhimLe ? 'Full' : `Tập ${currentEpisode}`}
            </p>
            <form onSubmit={handleSubmitReport} className="watch-report-form">
              <label className="watch-report-label">
                Loại lỗi
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="watch-report-select"
                  aria-label="Chọn loại lỗi"
                >
                  <option value="video_error">Lỗi phát video / không xem được</option>
                  <option value="subtitle">Lỗi phụ đề</option>
                  <option value="wrong_episode">Sai tập / nhầm nội dung</option>
                  <option value="other">Khác</option>
                </select>
              </label>
              <label className="watch-report-label">
                Mô tả thêm (tùy chọn)
                <textarea
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  className="watch-report-textarea"
                  placeholder="Mô tả ngắn gọn để chúng tôi xử lý nhanh hơn..."
                  rows={3}
                  maxLength={1000}
                />
              </label>
              <div className="modal-actions watch-report-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setReportModalOpen(false)} disabled={reportSubmitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={reportSubmitting}>
                  {reportSubmitting ? 'Đang gửi...' : 'Gửi báo cáo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rateBannerOpen && movie && (
        <WatchRateBanner
          movie={movie}
          userRating={userRating}
          onClose={() => setRateBannerOpen(false)}
          onRated={handleRatedFromBanner}
        />
      )}

      {movie?.trailer_url && (
        <TrailerModal
          isOpen={trailerOpen}
          onClose={() => setTrailerOpen(false)}
          trailerUrl={movie.trailer_url}
          title={movie.title ? `Trailer: ${toTitleCase(movie.title)}` : 'Trailer'}
        />
      )}
    </div>
  );
}
