/**
 * VideoPlayer — HLS adaptive, progress (seek + buffer + tooltip), quality, phụ đề, tốc độ, PiP, phím tắt.
 * Hỗ trợ VAST pre-roll (vastAdTagUrl): phát quảng cáo trước khi phát nội dung chính.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchVast, fireTrackingUrls } from '../utils/vast.js';

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function getQualityLabel(height) {
  if (!height || height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  return height ? `${height}p` : 'Tự động';
}

export default function VideoPlayer({
  src,
  sources = [],
  sourceIndex: controlledSourceIndex,
  onSourceIndexChange,
  poster = '',
  subtitles = [],
  containerRef,
  videoRef: externalVideoRef,
  onTimeUpdate,
  onPlay,
  onPause,
  onLoadedMetadata,
  onDurationChange,
  onBufferUpdate,
  onEnded,
  onError,
  onShortcutsHint,
  className = '',
  autoPlay = false,
  syncPlaying = false,
  initialTime = 0,
  vastAdTagUrl = '',
  adSkipOffsetSeconds = 0,
  onAdPlayingChange,
  resumeHintVisible = false,
  resumeHintSeconds = 0,
  resumeHintHasProgress = false,
  resumeHintPct = 0,
  onResumeHintStartOver,
  controlsVisible = true,
}) {
  const urls = sources.length > 0 ? sources.map((s) => s.url).filter(Boolean) : (src ? [src] : []);
  const [adState, setAdState] = useState({ status: 'idle', mediaUrl: null, tracking: null, clickThrough: null });
  const adPlayedStartRef = useRef(false);
  const [internalSourceIndex, setInternalSourceIndex] = useState(0);
  const sourceIndex = controlledSourceIndex !== undefined ? controlledSourceIndex : internalSourceIndex;
  const setSourceIndex = useCallback(
    (i) => {
      if (controlledSourceIndex === undefined) setInternalSourceIndex(i);
      onSourceIndexChange?.(i);
    },
    [controlledSourceIndex, onSourceIndexChange]
  );
  const currentUrl = urls[sourceIndex] ?? urls[0] ?? '';
  const effectiveSrc =
    adState.status === 'playing' && adState.mediaUrl
      ? adState.mediaUrl
      : adState.status === 'loading'
        ? ''
        : currentUrl;
  const isPlayingAd = adState.status === 'playing';
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [progressTooltip, setProgressTooltip] = useState({ time: 0, left: 0 });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [openMenu, setOpenMenu] = useState(null);
  const [qualityLevel, setQualityLevel] = useState(-1);
  const [qualityLevels, setQualityLevels] = useState([]);
  const [subtitleTrack, setSubtitleTrack] = useState(-1);
  const [skipRippleSide, setSkipRippleSide] = useState(null);
  const internalVideoRef = useRef(null);
  const hlsRef = useRef(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const adPlayingRef = useRef(false);
  const adTrackingRef = useRef({});
  const playAfterAdSkipRef = useRef(false);

  const isM3u8 = /\.m3u8(\?|$)/i.test(currentUrl) || currentUrl.includes('m3u8');
  const effectiveIsM3u8 = isPlayingAd ? false : (/\.m3u8(\?|$)/i.test(effectiveSrc) || effectiveSrc.includes('m3u8'));

  useEffect(() => {
    if (!currentUrl) return;
    setAdState({ status: 'idle', mediaUrl: null, tracking: null, clickThrough: null });
    onAdPlayingChange?.(false);
  }, [currentUrl, onAdPlayingChange]);

  useEffect(() => {
    if (!currentUrl || !vastAdTagUrl || adState.status !== 'idle') return;
    setAdState((prev) => ({ ...prev, status: 'loading' }));
    fetchVast(vastAdTagUrl)
      .then((vast) => {
        if (!vast?.mediaUrl) {
          setAdState({ status: 'done', mediaUrl: null, tracking: null });
          return;
        }
        fireTrackingUrls(vast.impressionUrls || []);
        adTrackingRef.current = { ...(vast.tracking || {}), clickTracking: vast.clickTracking || [] };
        adPlayedStartRef.current = false;
        setAdState({ status: 'playing', mediaUrl: vast.mediaUrl, tracking: vast.tracking || {}, clickThrough: vast.clickThrough || null });
        adPlayingRef.current = true;
        onAdPlayingChange?.(true);
      })
      .catch(() => {
        setAdState({ status: 'done', mediaUrl: null, tracking: null });
        onAdPlayingChange?.(false);
      });
  }, [currentUrl, vastAdTagUrl, adState.status]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const setSeek = useCallback(
    (e) => {
      const v = videoRef.current;
      const bar = e?.currentTarget;
      if (!v || !bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      v.currentTime = pct * duration;
    },
    [duration]
  );

  const skip = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
    setSkipRippleSide(delta > 0 ? 'right' : 'left');
    setTimeout(() => setSkipRippleSide(null), 600);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch (_) {}
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef?.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }, [containerRef]);

  const toggleSubtitle = useCallback(() => {
    const v = videoRef.current;
    if (!v?.textTracks) return;
    const tracks = v.textTracks;
    const next = (subtitleTrack + 2) % (tracks.length + 1);
    setSubtitleTrack(next - 1);
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = i === next - 1 ? 'showing' : 'hidden';
    }
    if (next === 0) for (let i = 0; i < tracks.length; i++) tracks[i].mode = 'hidden';
  }, [subtitleTrack]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;
  }, [playbackRate, currentUrl]);

  useEffect(() => {
    if (!effectiveSrc) return;
    const v = videoRef.current;
    if (!v) return;

    if (adState.status === 'playing' && adState.mediaUrl) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setQualityLevels([]);
      v.src = adState.mediaUrl;
      v.load();
      v.play().catch(() => {});
      return () => {
        v.src = '';
      };
    }

    const shouldPlay = () => {
      if (autoPlay || playAfterAdSkipRef.current) {
        v.play().catch(() => {});
        if (playAfterAdSkipRef.current) playAfterAdSkipRef.current = false;
      }
    };
    if (!effectiveIsM3u8) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      v.src = effectiveSrc;
      setQualityLevels([]);
      shouldPlay();
      return () => {
        v.src = '';
        setQualityLevels([]);
      };
    }
    const setupHls = async () => {
      try {
        const Hls = (await import('hls.js')).default;
        if (Hls.isSupported()) {
          if (hlsRef.current) hlsRef.current.destroy();
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(effectiveSrc);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            const levels = (data.levels || []).map((l) => ({ height: l.height, width: l.width }));
            setQualityLevels(levels);
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, () => {
            setQualityLevel(hls.currentLevel);
          });
          shouldPlay();
        } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
          v.src = effectiveSrc;
          shouldPlay();
        } else {
          v.src = effectiveSrc;
        }
      } catch {
        v.src = effectiveSrc;
        shouldPlay();
      }
    };
    setupHls();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      v.src = '';
      setQualityLevels([]);
    };
  }, [effectiveSrc, effectiveIsM3u8, adState.status, adState.mediaUrl, autoPlay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdateEv = () => {
      setCurrentTime(v.currentTime);
      if (!adPlayingRef.current) {
        onTimeUpdate?.(v.currentTime, v.duration);
        if (v.buffered.length > 0) {
          const end = v.buffered.end(v.buffered.length - 1);
          onBufferUpdate?.(v.currentTime, end, v.duration);
        }
      }
    };
    const onProgressEv = () => {
      if (v.buffered.length > 0) {
        setBufferedPct(v.duration > 0 ? (v.buffered.end(v.buffered.length - 1) / v.duration) * 100 : 0);
        if (!adPlayingRef.current) onBufferUpdate?.(v.currentTime, v.buffered.end(v.buffered.length - 1), v.duration);
      }
    };
    const onLoadedMetadataEv = () => {
      setDuration(v.duration);
      if (adPlayingRef.current) return;
      const seekTo = Number(initialTime);
      if (seekTo > 0 && Number.isFinite(seekTo)) {
        const dur = v.duration;
        if (dur && Number.isFinite(dur) && seekTo < dur) {
          v.currentTime = seekTo;
          setCurrentTime(seekTo);
        } else if (!dur || !Number.isFinite(dur)) {
          v.currentTime = seekTo;
          setCurrentTime(seekTo);
        }
      }
      onLoadedMetadata?.(v.duration);
      onDurationChange?.(v.duration);
    };
    const onDurationChangeEv = () => {
      setDuration(v.duration);
      if (!adPlayingRef.current) onDurationChange?.(v.duration);
    };
    const onEndedEv = () => {
      if (adPlayingRef.current) {
        fireTrackingUrls(adTrackingRef.current?.complete || []);
        setAdState({ status: 'done', mediaUrl: null, tracking: null });
        adPlayingRef.current = false;
        onAdPlayingChange?.(false);
        return;
      }
      onEnded?.();
    };
    const onPlayEv = () => {
      if (adPlayingRef.current && !adPlayedStartRef.current) {
        adPlayedStartRef.current = true;
        fireTrackingUrls(adTrackingRef.current?.start || []);
      }
      setPlaying(true);
      onPlay?.();
    };
    const onPauseEv = () => {
      setPlaying(false);
      onPause?.();
    };
    v.addEventListener('timeupdate', onTimeUpdateEv);
    v.addEventListener('progress', onProgressEv);
    v.addEventListener('loadedmetadata', onLoadedMetadataEv);
    v.addEventListener('durationchange', onDurationChangeEv);
    v.addEventListener('ended', onEndedEv);
    v.addEventListener('play', onPlayEv);
    v.addEventListener('pause', onPauseEv);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdateEv);
      v.removeEventListener('progress', onProgressEv);
      v.removeEventListener('loadedmetadata', onLoadedMetadataEv);
      v.removeEventListener('durationchange', onDurationChangeEv);
      v.removeEventListener('ended', onEndedEv);
      v.removeEventListener('play', onPlayEv);
      v.removeEventListener('pause', onPauseEv);
    };
  }, [currentUrl, effectiveSrc, onTimeUpdate, onPlay, onPause, onLoadedMetadata, onDurationChange, onBufferUpdate, onEnded, onAdPlayingChange, initialTime]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hlsRef.current) return;
    if (qualityLevel < 0) {
      hlsRef.current.currentLevel = -1;
      return;
    }
    hlsRef.current.currentLevel = qualityLevel;
  }, [qualityLevel, currentUrl]);

  useEffect(() => {
    if (!openMenu) return;
    const onDocClick = () => setOpenMenu(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openMenu]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      const v = videoRef.current;
      if (!v) return;
      const key = e.key;
      if (key === ' ') {
        e.preventDefault();
        if (!syncPlaying) togglePlay();
        onShortcutsHint?.();
        return;
      }
      if (key === 'ArrowLeft') {
        e.preventDefault();
        skip(-10);
        onShortcutsHint?.();
        return;
      }
      if (key === 'ArrowRight') {
        e.preventDefault();
        skip(10);
        onShortcutsHint?.();
        return;
      }
      if (key === 'f' || key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        onShortcutsHint?.();
        return;
      }
      if (key === 'm' || key === 'M') {
        e.preventDefault();
        toggleMute();
        onShortcutsHint?.();
        return;
      }
      if (key === 'p' || key === 'P') {
        e.preventDefault();
        togglePip();
        onShortcutsHint?.();
        return;
      }
      if (key === 'c' || key === 'C') {
        e.preventDefault();
        toggleSubtitle();
        onShortcutsHint?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, skip, toggleMute, togglePip, toggleFullscreen, toggleSubtitle, syncPlaying, onShortcutsHint]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const setQuality = (level) => {
    setQualityLevel(level);
    setOpenMenu(null);
  };

  const canSkipAd = adSkipOffsetSeconds > 0 && isPlayingAd && currentTime >= adSkipOffsetSeconds;
  const skipAdCountdown = isPlayingAd && adSkipOffsetSeconds > 0 && currentTime < adSkipOffsetSeconds
    ? Math.max(0, adSkipOffsetSeconds - Math.floor(currentTime))
    : 0;

  const skipAd = useCallback(() => {
    if (!adPlayingRef.current) return;
    fireTrackingUrls(adTrackingRef.current?.complete || []);
    setAdState({ status: 'done', mediaUrl: null, tracking: null, clickThrough: null });
    adPlayingRef.current = false;
    playAfterAdSkipRef.current = true;
    onAdPlayingChange?.(false);
  }, [onAdPlayingChange]);

  const handleAdClick = useCallback(() => {
    const url = adState.clickThrough;
    if (!url || !url.startsWith('http')) return;
    fireTrackingUrls(adTrackingRef.current?.clickTracking || []);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [adState.clickThrough]);

  if (!currentUrl) return null;

  const hideCenterButton = playing && !controlsVisible;
  return (
    <div className={`watch-player ${className} ${hideCenterButton ? 'controls-hidden' : ''}`}>
      <div className={`watch-player-container ${!playing ? 'paused' : ''}`}>
        {resumeHintVisible && (
          <div className="watch-resume-modal-overlay" role="dialog" aria-labelledby="watch-resume-modal-title" aria-modal="true">
            <div className="watch-resume-modal-card">
              <h2 id="watch-resume-modal-title" className="watch-resume-modal-title">THÔNG BÁO!</h2>
              <p className="watch-resume-modal-message">
                Bạn đã dừng lại ở <span className="watch-resume-modal-time">{Math.floor(resumeHintSeconds / 60)} phút {Math.floor(resumeHintSeconds % 60)} giây</span>
              </p>
              <div className="watch-resume-modal-actions">
                {resumeHintHasProgress && (
                  <button
                    type="button"
                    className="watch-resume-modal-btn watch-resume-modal-continue"
                    onClick={() => {
                      const v = videoRef.current;
                      if (v && resumeHintSeconds > 0) {
                        const sec = Number(resumeHintSeconds);
                        if (Number.isFinite(sec)) {
                          v.currentTime = sec;
                          setCurrentTime(sec);
                        }
                      }
                      onResumeHintContinue?.();
                      if (v && v.paused) v.play().catch(() => {});
                    }}
                  >
                    Tiếp tục xem
                  </button>
                )}
                <button
                  type="button"
                  className="watch-resume-modal-btn watch-resume-modal-startover"
                  onClick={() => {
                    const v = videoRef.current;
                    if (v) {
                      v.currentTime = 0;
                      if (v.paused) v.play().catch(() => {});
                    }
                    onResumeHintStartOver?.();
                  }}
                >
                  Xem lại từ đầu
                </button>
              </div>
            </div>
          </div>
        )}
        {isPlayingAd && (
          <div className="watch-ad-badge" aria-hidden>
            Quảng cáo
          </div>
        )}
        {isPlayingAd && adState.clickThrough && (
          <div
            className="watch-ad-click-overlay"
            onClick={handleAdClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAdClick(); } }}
            role="button"
            tabIndex={0}
            aria-label="Mở link quảng cáo"
            title="Click để mở link quảng cáo"
          />
        )}
        {isPlayingAd && adSkipOffsetSeconds > 0 && (
          <div className="watch-ad-skip-wrap">
            {canSkipAd ? (
              <button type="button" className="watch-ad-skip-btn" onClick={skipAd} aria-label="Bỏ qua quảng cáo">
                Bỏ qua
              </button>
            ) : (
              <span className="watch-ad-skip-countdown" aria-hidden>
                Bỏ qua sau {skipAdCountdown}s
              </span>
            )}
          </div>
        )}
        <video
          ref={videoRef}
          key={effectiveSrc || currentUrl}
          className="watch-video-el"
          poster={poster}
          controls={false}
          playsInline
          onError={() => onError?.()}
        >
          {subtitles.map((sub, i) => (
            <track
              key={sub.lang}
              kind="subtitles"
              src={sub.url}
              srcLang={sub.lang}
              label={sub.label || sub.lang}
            />
          ))}
        </video>
        <div className="watch-player-overlay" />
        <button
          type="button"
          className="watch-center-play"
          onClick={togglePlay}
          aria-label={playing ? 'Tạm dừng' : 'Phát'}
        >
          <i className={`fas fa-${playing ? 'pause' : 'play'}`} style={playing ? {} : { marginLeft: 4 }} />
        </button>
        <div className={`watch-skip-ripple left ${skipRippleSide === 'left' ? 'show' : ''}`}>
          <i className="fas fa-backward" /> 10s
        </div>
        <div className={`watch-skip-ripple right ${skipRippleSide === 'right' ? 'show' : ''}`}>
          <i className="fas fa-forward" /> 10s
        </div>

        <div className="watch-controls-overlay">
          <div className="watch-progress-row">
            <div
              className="watch-progress-wrap"
              onClick={setSeek}
              onMouseMove={(e) => {
                const bar = e.currentTarget;
                const rect = bar.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const t = pct * (duration || 0);
                setProgressTooltip({ time: t, left: e.clientX - rect.left });
              }}
            >
              <div className="watch-progress-bg">
                <div className="watch-progress-buffered" style={{ width: `${bufferedPct}%` }} />
                <div className="watch-progress-fill" style={{ width: `${progressPct}%` }} />
                <div className="watch-progress-thumb" style={{ left: `${progressPct}%` }} />
              </div>
              <div className="watch-progress-tooltip" style={{ left: progressTooltip.left }}>
                {formatTime(progressTooltip.time)}
              </div>
            </div>
            <span className="watch-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div className="watch-controls-bottom">
            <div className="watch-controls-row watch-controls-left">
              <button type="button" className="watch-ctrl-btn watch-ctrl-play" onClick={togglePlay} aria-label={playing ? 'Tạm dừng' : 'Phát'}>
                <i className={playing ? 'fas fa-pause' : 'fas fa-play'} />
              </button>
              <button type="button" className="watch-ctrl-btn" onClick={() => skip(-10)} aria-label="Lùi 10s">
                <i className="fas fa-rotate-left" />
              </button>
              <button type="button" className="watch-ctrl-btn" onClick={() => skip(10)} aria-label="Tới 10s">
                <i className="fas fa-rotate-right" />
              </button>
              <div className="watch-volume-wrap">
                <button type="button" className="watch-ctrl-btn" onClick={toggleMute} aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}>
                  <i className={muted ? 'fas fa-volume-xmark' : volume < 0.5 ? 'fas fa-volume-low' : 'fas fa-volume-high'} />
                </button>
                <div className="watch-volume-slider">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={muted ? 0 : volume * 100}
                    onChange={(e) => {
                      const val = Number(e.target.value) / 100;
                      setVolume(val);
                      setMuted(val === 0);
                      if (videoRef.current) videoRef.current.volume = val;
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="watch-controls-right">
              {sources.length > 1 && (
                <div className="watch-ctrl-menu-wrap">
                  <button
                    type="button"
                    className="watch-ctrl-btn"
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'server' ? null : 'server'); }}
                    title="Chọn máy chủ"
                  >
                    <i className="fas fa-server" />
                  </button>
                  <div className={`watch-ctrl-menu ${openMenu === 'server' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                    <div className="watch-ctrl-menu-title">Máy chủ</div>
                    {sources.map((s, i) => (
                      <div
                        key={i}
                        className={`watch-ctrl-menu-item ${sourceIndex === i ? 'active' : ''}`}
                        onClick={() => {
                          setSourceIndex(i);
                          setOpenMenu(null);
                        }}
                      >
                        {s.label || `Server ${i + 1}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {qualityLevels.length > 0 && (
                <div className="watch-ctrl-menu-wrap">
                  <button
                    type="button"
                    className="watch-ctrl-btn"
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'quality' ? null : 'quality'); }}
                    title="Chất lượng"
                  >
                    <i className="fas fa-display" />
                  </button>
                  <div className={`watch-ctrl-menu ${openMenu === 'quality' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                    <div className="watch-ctrl-menu-title">Chất lượng HLS</div>
                    <div className={`watch-ctrl-menu-item ${qualityLevel === -1 ? 'active' : ''}`} onClick={() => setQuality(-1)}>
                      Tự động
                    </div>
                    {qualityLevels.map((lev, i) => (
                      <div
                        key={i}
                        className={`watch-ctrl-menu-item ${qualityLevel === i ? 'active' : ''}`}
                        onClick={() => setQuality(i)}
                      >
                        {getQualityLabel(lev.height)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="watch-ctrl-menu-wrap">
                <button
                  type="button"
                  className="watch-ctrl-btn"
                  onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'speed' ? null : 'speed'); }}
                  title="Tốc độ"
                >
                  <i className="fas fa-gauge-high" />
                </button>
                <div className={`watch-ctrl-menu ${openMenu === 'speed' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                  <div className="watch-ctrl-menu-title">Tốc độ phát</div>
                  {SPEEDS.map((r) => (
                    <div
                      key={r}
                      className={`watch-ctrl-menu-item ${playbackRate === r ? 'active' : ''}`}
                      onClick={() => {
                        setPlaybackRate(r);
                        setOpenMenu(null);
                      }}
                    >
                      {r}× {r === 1 ? '(bình thường)' : ''}
                    </div>
                  ))}
                </div>
              </div>

              {subtitles.length > 0 && (
                <button type="button" className="watch-ctrl-btn" onClick={toggleSubtitle} title="Phụ đề">
                  <i className="fas fa-closed-captioning" />
                </button>
              )}

              <button type="button" className="watch-ctrl-btn" onClick={togglePip} aria-label="PiP" title="Cửa sổ nhỏ">
                <i className="fas fa-clone" />
              </button>
              <button type="button" className="watch-ctrl-btn" onClick={toggleFullscreen} aria-label="Toàn màn hình" title="Toàn màn hình">
                <i className="fas fa-expand" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
