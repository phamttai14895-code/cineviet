import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { toTitleCase } from '../../utils/titleCase.js';
import './AdminEpisodes.css';

export default function AdminEpisodes() {
  const { toast } = useToast();
  const [movieList, setMovieList] = useState([]);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalEpisodesInput, setTotalEpisodesInput] = useState(0);
  const [newServerName, setNewServerName] = useState('');
  const [addServerOpen, setAddServerOpen] = useState(false);
  const [addEpisodeServerIndex, setAddEpisodeServerIndex] = useState(null);
  const [addEpisodeForm, setAddEpisodeForm] = useState({ name: '', link_embed: '', link_m3u8: '' });
  const [editEpisode, setEditEpisode] = useState(null); // { serverIndex, episodeIndex, name, link_embed, link_m3u8 }

  const loadMovies = async () => {
    try {
      const res = await admin.movies({ limit: 200, page: 1 });
      setMovieList(res.data?.movies || []);
    } catch (e) {
      setMovieList([]);
    }
  };

  const loadEpisodes = async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await admin.getMovieEpisodes(id);
      setData(res.data);
      setTotalEpisodesInput(res.data?.total_episodes ?? 0);
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Không tải được danh sách tập';
      setError(msg);
      toast.error(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMovies(); }, []);
  useEffect(() => {
    if (selectedId) {
      loadEpisodes(selectedId);
      const m = movieList.find((x) => x.id === selectedId);
      setSelectedMovie(m || null);
    } else {
      setData(null);
      setSelectedMovie(null);
    }
  }, [selectedId, movieList]);

  const filteredMovies = search.trim()
    ? movieList.filter((m) => (m.title || '').toLowerCase().includes(search.toLowerCase()) || (m.slug || '').toLowerCase().includes(search.toLowerCase()))
    : [];
  const showDropdown = searchFocused && (search.trim() || filteredMovies.length > 0);
  const handleSelectMovie = (m) => {
    setSelectedId(m.id);
    setSearch('');
    setSearchFocused(false);
  };

  const handleSaveTotalEpisodes = async () => {
    if (!selectedId || data == null) return;
    try {
      const res = await admin.updateMovieEpisodes(selectedId, { episodes: data.episodes, total_episodes: Math.max(0, parseInt(totalEpisodesInput, 10) || 0) });
      setData((d) => (d ? { ...d, episodes: res.data.episodes, total_episodes: res.data.total_episodes } : null));
      setTotalEpisodesInput(res.data.total_episodes ?? 0);
      setError('');
      toast.success('Đã lưu.');
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Không lưu được';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleAddServer = async () => {
    if (!selectedId) return;
    const name = (newServerName || 'Nguồn').trim() || 'Nguồn';
    try {
      const res = await admin.addMovieEpisodeServer(selectedId, name);
      setData((d) => (d ? { ...d, episodes: res.data.episodes } : null));
      setNewServerName('');
      setAddServerOpen(false);
      setError('');
      toast.success('Đã thêm server.');
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Không thêm được server';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleAddEpisode = async () => {
    if (!selectedId || addEpisodeServerIndex == null || !addEpisodeForm.name.trim()) return;
    try {
      const res = await admin.addMovieEpisode(selectedId, addEpisodeServerIndex, {
        name: addEpisodeForm.name.trim(),
        link_embed: addEpisodeForm.link_embed.trim(),
        link_m3u8: addEpisodeForm.link_m3u8.trim(),
      });
      setData((d) => (d ? { ...d, episodes: res.data.episodes } : null));
      setAddEpisodeServerIndex(null);
      setAddEpisodeForm({ name: '', link_embed: '', link_m3u8: '' });
      setError('');
      toast.success('Đã thêm tập.');
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Không thêm được tập';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleUpdateEpisode = async () => {
    if (!selectedId || !editEpisode) return;
    const { serverIndex, episodeIndex, name, link_embed, link_m3u8 } = editEpisode;
    try {
      const res = await admin.updateMovieEpisode(selectedId, serverIndex, episodeIndex, { name, link_embed, link_m3u8 });
      setData((d) => (d ? { ...d, episodes: res.data.episodes } : null));
      setEditEpisode(null);
      setError('');
      toast.success('Đã sửa tập.');
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Không sửa được tập';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDeleteEpisode = async (serverIndex, episodeIndex) => {
    if (!selectedId || !window.confirm('Xóa tập này?')) return;
    try {
      const res = await admin.deleteMovieEpisodes(selectedId, serverIndex, episodeIndex);
      setData((d) => (d ? { ...d, episodes: res.data.episodes } : null));
      setError('');
      toast.success('Đã xóa tập.');
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Không xóa được tập';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDeleteServer = async (serverIndex) => {
    if (!selectedId || !window.confirm('Xóa cả server và mọi tập?')) return;
    try {
      const res = await admin.deleteMovieEpisodeServer(selectedId, serverIndex);
      setData((d) => (d ? { ...d, episodes: res.data.episodes } : null));
      setError('');
      toast.success('Đã xóa server.');
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Không xóa được server';
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="admin-episodes-page">
      <div className="admin-page-head">
        <h1 className="admin-episodes-title with-bar">Danh sách tập</h1>
        <p className="admin-episodes-desc">Chọn phim để thêm, sửa, xóa các tập (server + link từng tập).</p>
      </div>

      <div className="admin-episodes-select">
        <div className="admin-episodes-search-wrap">
          <input
            type="text"
            className="admin-episodes-search"
            placeholder={selectedMovie ? `Đang chọn: ${selectedMovie.title}` : 'Tìm phim theo tên hoặc slug...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
          />
          {showDropdown && (
            <div className="admin-episodes-dropdown">
              {filteredMovies.length === 0 ? (
                <div className="admin-episodes-dropdown-empty">Không tìm thấy phim. Thử từ khóa khác.</div>
              ) : (
                filteredMovies.slice(0, 12).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="admin-episodes-dropdown-item"
                    onClick={() => handleSelectMovie(m)}
                  >
                    <span className="admin-episodes-dropdown-title">{toTitleCase(m.title)}</span>
                    {m.total_episodes ? <span className="admin-episodes-dropdown-meta">{m.total_episodes} tập</span> : null}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {selectedMovie && (
          <button type="button" className="admin-episodes-clear-movie" onClick={() => { setSelectedId(null); setSearch(''); }} title="Bỏ chọn phim">
            <i className="fas fa-times" /> Bỏ chọn phim
          </button>
        )}
      </div>

      {error && <div className="admin-episodes-error">{error}</div>}

      {loading && <div className="admin-episodes-loading">Đang tải...</div>}

      {!loading && data && (
        <div className="admin-episodes-content">
          <div className="admin-episodes-header">
            <h2>{data.title}</h2>
            <Link to={`/movie/${data.movie_id}`} target="_blank" rel="noopener noreferrer" className="admin-episodes-link-movie">Xem phim</Link>
          </div>

          <div className="admin-episodes-total-row">
            <label>Số tập (hiển thị):</label>
            <input
              type="number"
              min={0}
              value={totalEpisodesInput}
              onChange={(e) => setTotalEpisodesInput(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveTotalEpisodes}>Lưu</button>
          </div>

          <div className="admin-episodes-servers">
            {(data.episodes || []).map((server, serverIndex) => (
              <div key={serverIndex} className="admin-episodes-server">
                <div className="admin-episodes-server-head">
                  <span className="admin-episodes-server-name">{server.server_name || 'Nguồn'}</span>
                  <div className="admin-episodes-server-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAddEpisodeServerIndex(serverIndex); setAddEpisodeForm({ name: '', link_embed: '', link_m3u8: '' }); }} title="Thêm tập">
                      <i className="fas fa-plus" /> Thêm tập
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDeleteServer(serverIndex)} title="Xóa server">
                      <i className="fas fa-trash" /> Xóa server
                    </button>
                  </div>
                </div>
                <ul className="admin-episodes-list">
                  {(server.server_data || []).map((ep, episodeIndex) => (
                    <li key={episodeIndex} className="admin-episodes-item">
                      <span className="admin-episodes-item-name">{ep.name || `Tập ${episodeIndex + 1}`}</span>
                      <span className="admin-episodes-item-link" title={ep.link_embed || ep.link_m3u8 || ''}>
                        {(ep.link_embed || ep.link_m3u8 || '—').slice(0, 50)}{(ep.link_embed || ep.link_m3u8 || '').length > 50 ? '…' : ''}
                      </span>
                      <div className="admin-episodes-item-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditEpisode({ serverIndex, episodeIndex, name: ep.name, link_embed: ep.link_embed || '', link_m3u8: ep.link_m3u8 || '' })} title="Sửa">
                          <i className="fas fa-pen" />
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDeleteEpisode(serverIndex, episodeIndex)} title="Xóa">
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {(!server.server_data || server.server_data.length === 0) && (
                  <p className="admin-episodes-empty-server">Chưa có tập. Bấm &quot;Thêm tập&quot;.</p>
                )}
              </div>
            ))}
          </div>

          <div className="admin-episodes-add-server">
            {!addServerOpen ? (
              <button type="button" className="btn btn-primary" onClick={() => setAddServerOpen(true)}>
                <i className="fas fa-plus" /> Thêm server
              </button>
            ) : (
              <div className="admin-episodes-add-server-form">
                <input
                  type="text"
                  placeholder="Tên server (vd: Vietsub #1)"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                />
                <button type="button" className="btn btn-primary" onClick={handleAddServer}>Thêm</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setAddServerOpen(false); setNewServerName(''); }}>Hủy</button>
              </div>
            )}
          </div>

          {addEpisodeServerIndex != null && (
            <div className="admin-episodes-modal">
              <div className="admin-episodes-modal-inner">
                <h3>Thêm tập</h3>
                <label>Tên tập <input type="text" value={addEpisodeForm.name} onChange={(e) => setAddEpisodeForm((f) => ({ ...f, name: e.target.value }))} placeholder="vd: Tập 1" /></label>
                <label>Link embed <input type="text" value={addEpisodeForm.link_embed} onChange={(e) => setAddEpisodeForm((f) => ({ ...f, link_embed: e.target.value }))} placeholder="https://..." /></label>
                <label>Link m3u8 (tùy chọn) <input type="text" value={addEpisodeForm.link_m3u8} onChange={(e) => setAddEpisodeForm((f) => ({ ...f, link_m3u8: e.target.value }))} placeholder="https://..." /></label>
                <div className="admin-episodes-modal-actions">
                  <button type="button" className="btn btn-primary" onClick={handleAddEpisode} disabled={!addEpisodeForm.name.trim()}>Thêm</button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setAddEpisodeServerIndex(null); setAddEpisodeForm({ name: '', link_embed: '', link_m3u8: '' }); }}>Hủy</button>
                </div>
              </div>
            </div>
          )}

          {editEpisode && (
            <div className="admin-episodes-modal">
              <div className="admin-episodes-modal-inner">
                <h3>Sửa tập</h3>
                <label>Tên tập <input type="text" value={editEpisode.name} onChange={(e) => setEditEpisode((x) => ({ ...x, name: e.target.value }))} /></label>
                <label>Link embed <input type="text" value={editEpisode.link_embed} onChange={(e) => setEditEpisode((x) => ({ ...x, link_embed: e.target.value }))} /></label>
                <label>Link m3u8 <input type="text" value={editEpisode.link_m3u8} onChange={(e) => setEditEpisode((x) => ({ ...x, link_m3u8: e.target.value }))} /></label>
                <div className="admin-episodes-modal-actions">
                  <button type="button" className="btn btn-primary" onClick={handleUpdateEpisode}>Lưu</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditEpisode(null)}>Hủy</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !data && !selectedId && (
        <div className="admin-episodes-empty">Gõ tên phim vào ô tìm kiếm và chọn một phim để quản lý tập.</div>
      )}
    </div>
  );
}
