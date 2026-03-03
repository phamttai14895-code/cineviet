import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { watchParty as watchPartyApi } from '../api/client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';
const MAX_OPTIONS = [
  { value: 4, label: 'Tối đa 4 người' },
  { value: 8, label: 'Tối đa 8 người' },
  { value: 16, label: 'Tối đa 16 người' },
  { value: 50, label: 'Tối đa 50 người' },
];
const PRIVACY_OPTIONS = [
  { value: true, label: 'Công khai', icon: 'globe' },
  { value: false, label: 'Riêng tư', icon: 'lock' },
];
const PUBLIC_ROOMS_PER_PAGE = 4;

export default function XemChung() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState('create');
  const [createForm, setCreateForm] = useState({
    hostName: '',
    videoUrl: '',
    movieTitle: '',
    maxMembers: 8,
    isPublic: true,
  });
  const [joinForm, setJoinForm] = useState({ userName: '', code: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publicRooms, setPublicRooms] = useState([]);
  const [loadingPublicRooms, setLoadingPublicRooms] = useState(false);
  const [publicRoomsPage, setPublicRoomsPage] = useState(1);
  const [joinModalRoom, setJoinModalRoom] = useState(null);
  const [joinModalName, setJoinModalName] = useState('');
  const [showCreateGuide, setShowCreateGuide] = useState(true);

  // Điền sẵn URL + tên phim + tên hiển thị khi chuyển từ trang Watch (nút "Xem chung")
  useEffect(() => {
    const prefillVideoUrl = location.state?.prefillVideoUrl;
    const prefillMovieTitle = location.state?.prefillMovieTitle;
    const prefillHostName = location.state?.prefillHostName;
    if (prefillVideoUrl != null || prefillMovieTitle != null || prefillHostName != null) {
      setShowCreateGuide(false);
      setCreateForm((f) => ({
        ...f,
        videoUrl: prefillVideoUrl != null ? String(prefillVideoUrl) : f.videoUrl,
        movieTitle: prefillMovieTitle != null ? String(prefillMovieTitle) : f.movieTitle,
        hostName: prefillHostName != null && prefillHostName !== '' ? String(prefillHostName) : f.hostName,
      }));
      setTab('create');
    }
  }, [location.state?.prefillVideoUrl, location.state?.prefillMovieTitle, location.state?.prefillHostName]);

  // Khi sang tab Vào phòng thì tải danh sách phòng công khai
  useEffect(() => {
    if (tab !== 'join') return;
    setPublicRoomsPage(1);
    setLoadingPublicRooms(true);
    watchPartyApi
      .publicRooms()
      .then((r) => setPublicRooms(r.data?.rooms || []))
      .catch(() => setPublicRooms([]))
      .finally(() => setLoadingPublicRooms(false));
  }, [tab]);

  const handleCreateRoom = (e, overrides) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const payload = overrides
      ? { ...createForm, ...overrides }
      : { hostName: createForm.hostName.trim() || 'Chủ phòng', videoUrl: createForm.videoUrl.trim(), movieTitle: createForm.movieTitle.trim() || 'Watch Party', maxMembers: createForm.maxMembers, isPublic: createForm.isPublic };
    const socket = io(SOCKET_URL || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => {
      socket.emit(
        'create-room',
        {
          hostName: payload.hostName || 'Chủ phòng',
          videoUrl: payload.videoUrl || '',
          movieTitle: payload.movieTitle || 'Watch Party',
          maxMembers: payload.maxMembers ?? 8,
          isPublic: payload.isPublic !== false,
        },
        (res) => {
          setLoading(false);
          if (res?.error) {
            setError(res.error);
            socket.disconnect();
            return;
          }
          if (res?.code) {
            socket.disconnect();
            navigate(`/xem-chung/phong/${res.code}`, {
              state: {
                userName: (payload.hostName || 'Chủ phòng').trim(),
                isHost: true,
              },
            });
          }
        }
      );
    });
    socket.on('connect_error', () => {
      setLoading(false);
      setError('Không thể kết nối server. Kiểm tra backend đã chạy chưa.');
      socket.disconnect();
    });
  };

  const handleQuickCreate = (e) => {
    e.preventDefault();
    handleCreateRoom(e, {
      hostName: 'Demo',
      videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      movieTitle: 'Demo Stream',
    });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError('');
    const code = joinForm.code.trim().toUpperCase();
    if (!code) {
      setError('Nhập mã phòng.');
      return;
    }
    doJoinRoom(code, joinForm.userName.trim() || 'Thành viên');
  };

  const doJoinRoom = (code, userName) => {
    setError('');
    setLoading(true);
    if (joinModalRoom) setJoinModalRoom(null);
    const socket = io(SOCKET_URL || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => {
      socket.emit(
        'join-room',
        { code, userName: userName || 'Thành viên' },
        (res) => {
          setLoading(false);
          if (res?.error) {
            setError(res.error);
            socket.disconnect();
            return;
          }
          if (res?.room) {
            socket.disconnect();
            navigate(`/xem-chung/phong/${code}`, {
              state: {
                userName: userName || 'Thành viên',
                isHost: false,
              },
            });
          }
        }
      );
    });
    socket.on('connect_error', () => {
      setLoading(false);
      setError('Không thể kết nối server.');
      socket.disconnect();
    });
  };

  const handleJoinFromPublicRoom = (room) => {
    setJoinModalRoom(room);
    setJoinModalName('');
  };

  const handleJoinModalSubmit = (e) => {
    e.preventDefault();
    const name = joinModalName.trim() || 'Thành viên';
    if (!joinModalRoom?.code) return;
    doJoinRoom(joinModalRoom.code, name);
  };

  return (
    <div className="watch-party-page">
      <div className="watch-party-card">
        <div className="watch-party-header">
          <span className="watch-party-icon" aria-hidden>🎉</span>
          <h1 className="watch-party-title">WATCH PARTY</h1>
          <p className="watch-party-subtitle">Xem phim cùng bạn bè theo thời gian thực</p>
        </div>

        <div className="watch-party-tabs">
          <button
            type="button"
            className={`watch-party-tab ${tab === 'create' ? 'active' : ''}`}
            onClick={() => { setTab('create'); setError(''); }}
          >
            Tạo phòng
          </button>
          <button
            type="button"
            className={`watch-party-tab ${tab === 'join' ? 'active' : ''}`}
            onClick={() => { setTab('join'); setError(''); }}
          >
            Vào phòng
          </button>
        </div>

        {error && (
          <div className="watch-party-error" role="alert">
            {error}
          </div>
        )}

        {tab === 'create' ? (
          (() => {
            const fromWatch = location.state?.prefillVideoUrl != null || location.state?.prefillMovieTitle != null || location.state?.prefillHostName != null;
            if (fromWatch) {
              return (
                <form onSubmit={handleCreateRoom} className="watch-party-form">
              <label className="watch-party-label">
                Tên của bạn (VD: An, Bình...)
                <input
                  type="text"
                  className="watch-party-input"
                  value={createForm.hostName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, hostName: e.target.value }))}
                  placeholder="An, Bình..."
                />
              </label>
              <label className="watch-party-label">
                URL phim (M3U8 hoặc MP4)
                <input
                  type="url"
                  className="watch-party-input"
                  value={createForm.videoUrl}
                  onChange={(e) => setCreateForm((f) => ({ ...f, videoUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </label>
              <label className="watch-party-label">
                Tên phim (VD: Dune: Part Two)
                <input
                  type="text"
                  className="watch-party-input"
                  value={createForm.movieTitle}
                  onChange={(e) => setCreateForm((f) => ({ ...f, movieTitle: e.target.value }))}
                  placeholder="Dune: Part Two"
                />
              </label>
              <div className="watch-party-row">
                <label className="watch-party-label watch-party-select-wrap">
                  Tối đa {createForm.maxMembers} người
                  <select
                    className="watch-party-select"
                    value={createForm.maxMembers}
                    onChange={(e) => setCreateForm((f) => ({ ...f, maxMembers: Number(e.target.value) }))}
                  >
                    {MAX_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="watch-party-label watch-party-select-wrap">
                  {createForm.isPublic ? 'Công khai' : 'Riêng tư'}
                  <select
                    className="watch-party-select"
                    value={createForm.isPublic ? 'public' : 'private'}
                    onChange={(e) => setCreateForm((f) => ({ ...f, isPublic: e.target.value === 'public' }))}
                  >
                    <option value="public">Công khai</option>
                    <option value="private">Riêng tư</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="watch-party-btn watch-party-btn-primary" disabled={loading}>
                <i className="fas fa-bolt" /> {loading ? 'Đang tạo...' : 'Tạo phòng ngay'}
              </button>
              <p className="watch-party-or">hoặc</p>
              <button
                type="button"
                className="watch-party-btn watch-party-btn-secondary"
                onClick={handleQuickCreate}
                disabled={loading}
              >
                <i className="fas fa-bolt" /> Tạo nhanh (demo)
              </button>
            </form>
              );
            }
            if (showCreateGuide) {
              return (
                <div className="watch-party-create-guide">
                  <h3 className="watch-party-create-guide-title">Tạo phòng xem chung</h3>
                  <p className="watch-party-create-guide-subtitle">Hướng dẫn nhanh cách tạo phòng xem chung</p>
                  <ol className="watch-party-create-guide-steps">
                    <li className="watch-party-create-guide-step">
                      <span className="watch-party-create-guide-num" aria-hidden>1</span>
                      <span>Tìm phim bạn muốn xem chung.</span>
                    </li>
                    <li className="watch-party-create-guide-step">
                      <span className="watch-party-create-guide-num" aria-hidden>2</span>
                      <span>Chuyển tới trang xem của tập phim đó, chọn biểu tượng <span className="watch-party-create-guide-highlight"><i className="fas fa-users" aria-hidden /> Xem chung</span> trên thanh công cụ phía dưới player.</span>
                    </li>
                    <li className="watch-party-create-guide-step">
                      <span className="watch-party-create-guide-num" aria-hidden>3</span>
                      <span>Điền thông tin.</span>
                    </li>
                    <li className="watch-party-create-guide-step">
                      <span className="watch-party-create-guide-num" aria-hidden>4</span>
                      <span>Hoàn thành và chia sẻ cho bạn bè.</span>
                    </li>
                  </ol>
                  <button
                    type="button"
                    className="watch-party-create-guide-btn"
                    onClick={() => setShowCreateGuide(false)}
                  >
                    Đã hiểu
                  </button>
                </div>
              );
            }
            return (
              <div className="watch-party-create-guide-done">
                <p className="watch-party-create-guide-done-text">Để tạo phòng, hãy vào trang xem phim và bấm nút <strong>Xem chung</strong> trên thanh công cụ phía dưới player.</p>
                <Link to="/" className="watch-party-create-guide-done-link">
                  <i className="fas fa-film" /> Về trang chủ
                </Link>
              </div>
            );
          })()
        ) : (
          <>
            <div className="watch-party-public-rooms">
              <h3 className="watch-party-public-rooms-title">Phòng công khai</h3>
              {loadingPublicRooms ? (
                <p className="watch-party-public-rooms-loading">Đang tải...</p>
              ) : publicRooms.length === 0 ? (
                <p className="watch-party-public-rooms-loading">Chưa có phòng công khai nào.</p>
              ) : (
                <>
                  <ul className="watch-party-public-rooms-list">
                    {publicRooms
                      .slice((publicRoomsPage - 1) * PUBLIC_ROOMS_PER_PAGE, publicRoomsPage * PUBLIC_ROOMS_PER_PAGE)
                      .map((room) => (
                        <li
                          key={room.code}
                          className="watch-party-public-rooms-item"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleJoinFromPublicRoom(room)}
                          onKeyDown={(e) => e.key === 'Enter' && handleJoinFromPublicRoom(room)}
                        >
                          <div className="watch-party-public-rooms-info">
                            <span className="watch-party-public-rooms-code">{room.code}</span>
                            <span className="watch-party-public-rooms-movie">{room.movieTitle}</span>
                            <span className="watch-party-public-rooms-members">
                              {room.memberNames?.length ? room.memberNames.join(', ') : ''}
                            </span>
                            <span className="watch-party-public-rooms-meta">
                              {room.memberCount}/{room.maxMembers} thành viên
                            </span>
                          </div>
                          <span className="watch-party-public-rooms-enter">
                            <i className="fas fa-chevron-right" /> Vào
                          </span>
                        </li>
                      ))}
                  </ul>
                  {publicRooms.length > PUBLIC_ROOMS_PER_PAGE && (
                    <div className="watch-party-public-rooms-pagination">
                      <button
                        type="button"
                        className="watch-party-pagination-btn"
                        disabled={publicRoomsPage <= 1}
                        onClick={() => setPublicRoomsPage((p) => Math.max(1, p - 1))}
                        aria-label="Trang trước"
                      >
                        <i className="fas fa-chevron-left" /> Trước
                      </button>
                      <span className="watch-party-pagination-info">
                        Trang {publicRoomsPage} / {Math.ceil(publicRooms.length / PUBLIC_ROOMS_PER_PAGE)}
                      </span>
                      <button
                        type="button"
                        className="watch-party-pagination-btn"
                        disabled={publicRoomsPage >= Math.ceil(publicRooms.length / PUBLIC_ROOMS_PER_PAGE)}
                        onClick={() => setPublicRoomsPage((p) => Math.min(Math.ceil(publicRooms.length / PUBLIC_ROOMS_PER_PAGE), p + 1))}
                        aria-label="Trang sau"
                      >
                        Sau <i className="fas fa-chevron-right" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <p className="watch-party-or">hoặc nhập mã phòng</p>
            <form onSubmit={handleJoinRoom} className="watch-party-form">
              <label className="watch-party-label">
                Tên của bạn
                <input
                  type="text"
                  className="watch-party-input"
                  value={joinForm.userName}
                  onChange={(e) => setJoinForm((f) => ({ ...f, userName: e.target.value }))}
                  placeholder="Tên hiển thị"
                />
              </label>
              <label className="watch-party-label">
                Mã phòng
                <input
                  type="text"
                  className="watch-party-input"
                  value={joinForm.code}
                  onChange={(e) => setJoinForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="CINE-XXXX"
                  maxLength={9}
                />
              </label>
              <button type="submit" className="watch-party-btn watch-party-btn-primary" disabled={loading}>
                {loading ? 'Đang vào...' : 'Vào phòng'}
              </button>
            </form>
          </>
        )}

        <p className="watch-party-footer">
          Chia sẻ mã phòng để bạn bè cùng tham gia • Video đồng bộ realtime
        </p>
      </div>

      {joinModalRoom && (
        <div className="watch-party-modal-overlay" onClick={() => setJoinModalRoom(null)}>
          <div className="watch-party-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="watch-party-modal-title">Vào phòng {joinModalRoom.code}</h3>
            <p className="watch-party-modal-subtitle">{joinModalRoom.movieTitle}</p>
            <form onSubmit={handleJoinModalSubmit} className="watch-party-form">
              <label className="watch-party-label">
                Tên của bạn
                <input
                  type="text"
                  className="watch-party-input"
                  value={joinModalName}
                  onChange={(e) => setJoinModalName(e.target.value)}
                  placeholder="Tên hiển thị"
                  autoFocus
                />
              </label>
              <div className="watch-party-modal-actions">
                <button type="button" className="watch-party-btn watch-party-btn-secondary" onClick={() => setJoinModalRoom(null)}>
                  Hủy
                </button>
                <button type="submit" className="watch-party-btn watch-party-btn-primary" disabled={loading}>
                  {loading ? 'Đang vào...' : 'Vào phòng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
