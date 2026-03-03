import { useState, useEffect, useCallback, useRef } from 'react';
import { movies as moviesApi } from '../api/client.js';
import { toTitleCase } from '../utils/titleCase.js';
import { imageDisplayUrl } from '../utils/imageUrl.js';

const SUGGEST_LIMIT = 3;

const SUGGEST_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Modal thêm phim vào playlist (phòng xem chung):
 * Bước 1: Tìm phim (search) — gõ hiện gợi ý
 * Bước 2: Chọn phim từ kết quả
 * Bước 3: Chọn tập (hoặc Full nếu phim lẻ)
 */
export default function AddToPlaylistModal({ isOpen, onClose, onAdd }) {
  const [step, setStep] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverIndex, setServerIndex] = useState(0);
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const searchWrapRef = useRef(null);

  const reset = useCallback(() => {
    setStep('search');
    setSearchQuery('');
    setSearchResults([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedMovie(null);
    setServerIndex(0);
    setEpisodeIndex(0);
    setError('');
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  // Gợi ý khi gõ (debounce)
  useEffect(() => {
    if (step !== 'search') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = searchQuery.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setShowSuggestions(!!q);
      return;
    }
    const t = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const { data } = await moviesApi.suggest(q, SUGGEST_LIMIT);
        setSuggestions((data?.movies || []).slice(0, SUGGEST_LIMIT));
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [step, searchQuery]);

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await moviesApi.list({ search: q, limit: 20 });
      setSearchResults(data?.movies || []);
      setStep('results');
    } catch (err) {
      setError('Không tìm thấy phim. Thử từ khóa khác.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleSelectMovie = useCallback(async (movie) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setLoading(true);
    setError('');
    try {
      const { data } = await moviesApi.get(movie.id);
      setSelectedMovie(data);
      setServerIndex(0);
      setEpisodeIndex(0);
      setStep('episode');
    } catch (err) {
      setError('Không tải được thông tin phim.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Đóng dropdown gợi ý khi click bên ngoài
  useEffect(() => {
    if (!isOpen || !showSuggestions) return;
    const onDocClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen, showSuggestions]);

  const episodes = selectedMovie?.episodes || [];
  const currentServer = episodes[serverIndex];
  const serverData = currentServer?.server_data || [];
  const isPhimLe = !selectedMovie || (selectedMovie.type !== 'series' && selectedMovie.type !== 'anime') || (selectedMovie.total_episodes || 0) <= 1;

  const getSelectedUrl = useCallback(() => {
    if (!selectedMovie) return null;
    if (isPhimLe) {
      const firstUrl = selectedMovie.video_url && /\.(m3u8|mp4|webm)/i.test(selectedMovie.video_url)
        ? selectedMovie.video_url.trim()
        : null;
      if (firstUrl) return { url: firstUrl, title: toTitleCase(selectedMovie.title || 'Phim') };
      if (serverData.length > 0) {
        const first = serverData[0];
        const m3u8 = (first?.link_m3u8 || '').trim();
        if (m3u8) return { url: m3u8, title: toTitleCase(selectedMovie.title || 'Phim') };
      }
      return null;
    }
    const ep = serverData[episodeIndex] || serverData[String(episodeIndex + 1)] || serverData[String(episodeIndex)];
    const link = ep?.link_m3u8?.trim() || ep?.link_embed?.trim();
    if (!link) return null;
    const isM3u8 = /\.m3u8|m3u8/i.test(link);
    const url = isM3u8 ? link : link;
    const title = `${toTitleCase(selectedMovie.title || 'Phim')} - Tập ${episodeIndex + 1}`;
    return { url, title };
  }, [selectedMovie, isPhimLe, serverData, episodeIndex]);

  const handleAddToPlaylist = useCallback(async () => {
    const result = getSelectedUrl();
    if (!result || !onAdd) return;
    setAdding(true);
    try {
      onAdd(result.url, result.title);
      onClose?.();
    } finally {
      setAdding(false);
    }
  }, [getSelectedUrl, onAdd, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay watch-party-add-modal-overlay" onClick={() => onClose?.()} role="dialog" aria-modal="true" aria-labelledby="add-playlist-modal-title">
      <div className="modal watch-party-add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="watch-party-add-modal-head">
          <h2 id="add-playlist-modal-title" className="watch-party-add-modal-title">
            Thêm phim vào playlist
          </h2>
          <button type="button" className="watch-party-add-modal-close" onClick={onClose} aria-label="Đóng">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="watch-party-add-modal-body">
          {step === 'search' && (
            <form onSubmit={handleSearch} className="watch-party-add-search-form">
              <div className="watch-party-add-search-wrap" ref={searchWrapRef}>
                <label className="watch-party-add-label">
                  Tìm phim
                  <input
                    type="text"
                    className="watch-party-add-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchQuery.trim().length >= MIN_QUERY_LENGTH && setShowSuggestions(true)}
                    placeholder="Nhập tên phim (gõ 2 ký tự trở lên để xem gợi ý)..."
                    autoFocus
                    autoComplete="off"
                  />
                </label>
                {showSuggestions && (
                  <div className="watch-party-add-suggestions">
                    {suggestionsLoading ? (
                      <div className="watch-party-add-suggest-loading">
                        <i className="fas fa-spinner fa-spin" /> Đang tìm...
                      </div>
                    ) : suggestions.length > 0 ? (
                      <ul className="watch-party-add-suggest-list">
                        {suggestions.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              className="watch-party-add-suggest-item"
                              onClick={() => handleSelectMovie(m)}
                            >
                              {m.poster || m.thumbnail ? (
                                <img src={imageDisplayUrl(m.thumbnail || m.poster)} alt="" className="watch-party-add-suggest-poster" loading="lazy" />
                              ) : (
                                <span className="watch-party-add-suggest-poster watch-party-add-suggest-poster-ph">🎬</span>
                              )}
                              <span className="watch-party-add-suggest-text">
                                <span className="watch-party-add-suggest-title">{toTitleCase(m.title || 'Phim')}</span>
                                {m.release_year && <span className="watch-party-add-suggest-year">{m.release_year}</span>}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : searchQuery.trim().length >= MIN_QUERY_LENGTH && !suggestionsLoading ? (
                      <div className="watch-party-add-suggest-empty">Không có gợi ý. Thử từ khóa khác hoặc bấm Tìm kiếm.</div>
                    ) : searchQuery.trim().length > 0 ? (
                      <div className="watch-party-add-suggest-empty">Gõ thêm để xem gợi ý (tối thiểu 2 ký tự)</div>
                    ) : null}
                  </div>
                )}
              </div>
              <button type="submit" className="watch-party-btn watch-party-btn-primary" disabled={loading || !searchQuery.trim()}>
                {loading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-search" />} Tìm kiếm
              </button>
            </form>
          )}

          {step === 'results' && (
            <>
              <div className="watch-party-add-toolbar">
                <button type="button" className="watch-party-btn watch-party-btn-ghost" onClick={() => setStep('search')}>
                  <i className="fas fa-arrow-left" /> Đổi từ khóa
                </button>
              </div>
              {error && <p className="watch-party-add-error">{error}</p>}
              <ul className="watch-party-add-results">
                {searchResults.length === 0 && !loading && (
                  <li className="watch-party-add-empty">Không có kết quả.</li>
                )}
                {searchResults.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="watch-party-add-result-item"
                      onClick={() => handleSelectMovie(m)}
                      disabled={loading}
                    >
                      <span className="watch-party-add-result-title">{toTitleCase(m.title || 'Phim')}</span>
                      {m.release_year && <span className="watch-party-add-result-year">{m.release_year}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 'episode' && selectedMovie && (
            <>
              <div className="watch-party-add-toolbar">
                <button type="button" className="watch-party-btn watch-party-btn-ghost" onClick={() => { setSelectedMovie(null); setStep('results'); }}>
                  <i className="fas fa-arrow-left" /> Đổi phim
                </button>
              </div>
              <p className="watch-party-add-movie-name">{toTitleCase(selectedMovie.title || 'Phim')}</p>

              {isPhimLe ? (
                <div className="watch-party-add-ep-info">
                  <p>Phim lẻ — sẽ thêm 1 mục (Full).</p>
                  {!getSelectedUrl() && (
                    <p className="watch-party-add-error">Phim này chưa có link phát phù hợp (cần M3U8/MP4).</p>
                  )}
                </div>
              ) : (
                <>
                  {episodes.length > 1 && (
                    <label className="watch-party-add-label">
                      Server
                      <select
                        className="watch-party-add-select"
                        value={serverIndex}
                        onChange={(e) => { setServerIndex(Number(e.target.value)); setEpisodeIndex(0); }}
                      >
                        {episodes.map((ep, i) => (
                          <option key={i} value={i}>
                            {(ep.server_name || '').replace(/\s*\[(Ophim|PhimAPI|Nguonc)\]\s*/gi, ' ').trim() || `Server ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="watch-party-add-label">Chọn tập</label>
                  <div className="watch-party-add-episodes">
                    {serverData.length === 0 && (
                      <p className="watch-party-add-error">Không có tập nào.</p>
                    )}
                    {serverData.map((ep, i) => {
                      const link = ep?.link_m3u8?.trim() || ep?.link_embed?.trim();
                      const name = ep?.name || `Tập ${i + 1}`;
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`watch-party-add-ep-btn ${episodeIndex === i ? 'active' : ''}`}
                          onClick={() => setEpisodeIndex(i)}
                          disabled={!link}
                          title={!link ? 'Không có link' : name}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {getSelectedUrl() && (
                <div className="watch-party-add-actions">
                  <button
                    type="button"
                    className="watch-party-btn watch-party-btn-primary"
                    onClick={handleAddToPlaylist}
                    disabled={adding}
                  >
                    {adding ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />} Thêm vào playlist
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
