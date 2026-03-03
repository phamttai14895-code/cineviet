import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import VideoPlayer from '../components/VideoPlayer';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import { toTitleCase } from '../utils/titleCase.js';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';
const REACTIONS = ['❤️', '😅', '😱', '🔥', '💯', '👋', '😂', '😮', '👍', '🎉', '👏', '🙌', '😍'];

export default function XemChungRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const code = (roomId || '').toUpperCase().trim();
  const stateUserName = location.state?.userName;
  const [userName, setUserName] = useState(stateUserName || '');
  const [needName, setNeedName] = useState(!stateUserName);
  const [room, setRoom] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('chat');
  const [chatInput, setChatInput] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [flyingEmojis, setFlyingEmojis] = useState([]);
  const [showGuidePopup, setShowGuidePopup] = useState(true);
  const [addPlaylistModalOpen, setAddPlaylistModalOpen] = useState(false);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const playerWrapRef = useRef(null);
  const lastSyncRef = useRef(0);
  const lastFromRef = useRef(null);

  const connect = useCallback(() => {
    if (!code || !userName.trim()) return;
    const socket = io(SOCKET_URL || undefined, { path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', { code, userName: userName.trim() }, (res) => {
        if (res?.error) {
          setRoom(null);
          return;
        }
        if (res?.room) setRoom(res.room);
      });
    });

    socket.on('room-state', (data) => {
      setRoom(data);
      lastFromRef.current = data?._from || null;
    });
    socket.on('chat-message', (msg) => {
      setRoom((r) => (r ? { ...r, messages: [...(r.messages || []), msg] } : r));
      if (msg.type === 'reaction' && msg.payload) {
        const id = msg.id || `fly-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setFlyingEmojis((prev) => [
          ...prev,
          {
            id,
            emoji: msg.payload,
            startX: 15 + Math.random() * 70,
            startY: 75 + Math.random() * 20,
            drift: (Math.random() - 0.5) * 80,
          },
        ]);
        setTimeout(() => {
          setFlyingEmojis((p) => p.filter((e) => e.id !== id));
        }, 2800);
      }
    });
    socket.on('disconnect', () => setRoom(null));
    return () => {
      socket.emit('leave-room');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, userName]);

  useEffect(() => {
    if (!needName && userName && code) {
      return connect();
    }
  }, [needName, userName, code, connect]);

  const onVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current || !socketRef.current || !room || !syncEnabled) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 1000) return;
    lastSyncRef.current = now;
    socketRef.current.emit('sync-state', {
      currentTime: videoRef.current.currentTime,
      playing: !videoRef.current.paused,
    });
  }, [room, syncEnabled]);

  const onVideoPlay = useCallback(() => {
    if (!room || !syncEnabled) return;
    socketRef.current?.emit('sync-state', {
      currentTime: videoRef.current?.currentTime ?? 0,
      playing: true,
    });
  }, [room, syncEnabled]);

  const onVideoPause = useCallback(() => {
    if (!room || !syncEnabled) return;
    socketRef.current?.emit('sync-state', {
      currentTime: videoRef.current?.currentTime ?? 0,
      playing: false,
    });
  }, [room, syncEnabled]);

  const handleEnterRoom = (e) => {
    e.preventDefault();
    const name = userName.trim();
    if (!name) return;
    setUserName(name);
    setNeedName(false);
  };

  const copyCode = () => {
    if (code) {
      navigator.clipboard?.writeText(code);
    }
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
      socketRef.current.disconnect();
    }
    navigate('/xem-chung');
  };

  const sendMessage = (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit('chat-message', { text }, () => setChatInput(''));
  };

  const sendReaction = (emoji) => {
    socketRef.current?.emit('reaction', { emoji });
  };

  const syncVideoToRoom = useCallback(() => {
    if (!room || !videoRef.current || !syncEnabled) return;
    // Nếu gói room-state này do chính client hiện tại gửi ra,
    // không cần ép lại trạng thái local (tránh "bật lại" sau khi bấm pause/tua).
    if (lastFromRef.current && socketRef.current && lastFromRef.current === socketRef.current.id) {
      return;
    }
    const v = videoRef.current;
    const diff = Math.abs(v.currentTime - room.currentTime);
    if (diff > (room.syncSettings?.autoSyncThreshold ?? 5)) {
      v.currentTime = room.currentTime;
    } else if (diff > 0.5) {
      v.currentTime = room.currentTime;
    }
    if (room.playing && v.paused) {
      v.play().catch(() => {});
    } else if (!room.playing && !v.paused) {
      v.pause();
    }
  }, [room, syncEnabled]);

  useEffect(() => {
    if (!room) return;
    syncVideoToRoom();
  }, [room?.currentTime, room?.playing, syncVideoToRoom]);

  useEffect(() => {
    if (!room?.videoUrl || !syncEnabled) return;
    const id = setInterval(syncVideoToRoom, 2000);
    return () => clearInterval(id);
  }, [room?.videoUrl, syncEnabled, syncVideoToRoom]);

  const openAddPlaylistModal = () => setAddPlaylistModalOpen(true);
  const handleAddToPlaylist = (url, title) => {
    if (url && socketRef.current) {
      socketRef.current.emit('playlist-add', { url, title: title || 'Phim' });
    }
  };

  const playPlaylistIndex = (index) => {
    socketRef.current?.emit('playlist-play', { index });
  };

  const updateSyncSettings = (key, value) => {
    socketRef.current?.emit('sync-settings', { [key]: value });
    setRoom((r) =>
      r
        ? {
            ...r,
            syncSettings: { ...r.syncSettings, [key]: value },
          }
        : r
    );
  };

  if (!code) {
    navigate('/xem-chung');
    return null;
  }

  if (needName) {
    return (
      <div className="watch-party-page">
        <div className="watch-party-card">
          <h2 className="watch-party-title">Vào phòng {code}</h2>
          <form onSubmit={handleEnterRoom} className="watch-party-form">
            <label className="watch-party-label">
              Tên của bạn
              <input
                type="text"
                className="watch-party-input"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Tên hiển thị"
                autoFocus
              />
            </label>
            <button type="submit" className="watch-party-btn watch-party-btn-primary">
              Vào phòng
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="watch-party-page">
        <div className="watch-party-card">
          <p>Đang kết nối phòng {code}...</p>
        </div>
      </div>
    );
  }

  const messages = room.messages || [];
  const playlist = room.playlist || [];
  const playIndex = room.playIndex ?? 0;
  const videoUrl = room.videoUrl || '';
  const syncSettings = room.syncSettings || {};

  const isDirectVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const u = url.toLowerCase().split('?')[0];
    return /\.(mp4|m3u8|webm|ogg|mov)(\?|$)/i.test(u);
  };
  const useIframe = videoUrl && !isDirectVideoUrl(videoUrl);

  return (
    <div className="watch-party-room">
      {showGuidePopup && (
        <div className="watch-party-guide-overlay" role="dialog" aria-labelledby="watch-party-guide-title">
          <div className="watch-party-guide-card">
            <h2 id="watch-party-guide-title" className="watch-party-guide-title">
              Hướng dẫn sử dụng trình phát
            </h2>
            <ul className="watch-party-guide-list">
              <li>Sử dụng phím mũi tên <kbd>←</kbd> <kbd>→</kbd> để tua</li>
              <li>Sử dụng phím <kbd>Space</kbd> để tạm dừng và phát</li>
              <li>Sử dụng phím <kbd>F</kbd> để mở toàn màn hình</li>
            </ul>
            <button type="button" className="watch-party-guide-btn" onClick={() => setShowGuidePopup(false)}>
              Đã hiểu
            </button>
          </div>
        </div>
      )}
      <header className="watch-party-room-header">
        <div className="watch-party-room-brand">
          <a href="/" className="logo logo-gradient">CINEVIET</a>
          <span className="watch-party-badge">Watch Party</span>
        </div>
        <div className="watch-party-room-actions">
          <div className="watch-party-room-code-wrap">
            <span className="watch-party-room-code-label">Mã phòng:</span>
            <span className="watch-party-room-code">{code}</span>
            <button type="button" className="watch-party-icon-btn watch-party-icon-btn-inline" onClick={copyCode} aria-label="Copy mã phòng">
              <i className="fas fa-copy" />
            </button>
          </div>
          <button type="button" className="watch-party-btn watch-party-btn-leave" onClick={leaveRoom}>
            <i className="fas fa-sign-out-alt" /> Rời phòng
          </button>
        </div>
      </header>

      <div className="watch-party-room-body">
        <div className="watch-party-player-wrap" ref={playerWrapRef}>
          <div className="watch-party-sync-bar">
            <button
              type="button"
              className={`watch-party-sync-btn ${syncEnabled ? 'on' : ''}`}
              onClick={() => setSyncEnabled((v) => !v)}
            >
              <span className="watch-party-sync-dot" /> Đồng bộ
            </button>
          </div>
          <div className="watch-party-flying-emojis" aria-hidden>
            {flyingEmojis.map(({ id, emoji, startX, startY, drift }) => (
              <div
                key={id}
                className="watch-party-flying-emoji"
                style={{
                  '--start-x': `${startX}%`,
                  '--start-y': `${startY}%`,
                  '--drift': `${drift}px`,
                }}
              >
                {emoji}
              </div>
            ))}
          </div>
          <div className="watch-party-video-container">
            {videoUrl ? (
              useIframe ? (
                <iframe
                  key={videoUrl}
                  src={videoUrl}
                  title="Xem chung"
                  className="watch-video-el watch-iframe"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <VideoPlayer
                  src={videoUrl}
                  videoRef={videoRef}
                  containerRef={playerWrapRef}
                  onTimeUpdate={onVideoTimeUpdate}
                  onPlay={onVideoPlay}
                  onPause={onVideoPause}
                  className="watch-party-video-player"
                />
              )
            ) : (
              <div className="watch-party-video-placeholder">
                <p>Chưa có video. Thêm URL khi tạo phòng hoặc thêm vào Playlist.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="watch-party-sidebar">
          <div className="watch-party-sidebar-head">
            <h3 className="watch-party-sidebar-title">THÀNH VIÊN</h3>
            <span className="watch-party-members-count">
              {room.members?.length ? (
                <>
                  {room.members.slice(0, 3).map((member, i) => (
                    <span key={member.id || i} className="watch-party-member-avatar watch-party-member-avatar-sm" title={member.name}>
                      {(member.name || '?').charAt(0).toUpperCase()}
                    </span>
                  ))}
                  <span className="watch-party-members-num">{room.members.length}</span>
                </>
              ) : (
                <span className="watch-party-members-num">0</span>
              )}
            </span>
          </div>
          <div className="watch-party-tabs watch-party-tabs-small">
            <button
              type="button"
              className={`watch-party-tab ${sidebarTab === 'chat' ? 'active' : ''}`}
              onClick={() => setSidebarTab('chat')}
            >
              <i className="fas fa-comment" /> Chat
            </button>
            <button
              type="button"
              className={`watch-party-tab ${sidebarTab === 'playlist' ? 'active' : ''}`}
              onClick={() => setSidebarTab('playlist')}
            >
              <i className="fas fa-list" /> Playlist
            </button>
            <button
              type="button"
              className={`watch-party-tab ${sidebarTab === 'settings' ? 'active' : ''}`}
              onClick={() => setSidebarTab('settings')}
            >
              <i className="fas fa-cog" /> Cài đặt
            </button>
          </div>

          {sidebarTab === 'chat' && (
            <div className="watch-party-chat">
              <div className="watch-party-chat-messages">
                {messages.map((m) => {
                  const isMe = m.userName && String(m.userName).trim() === String(userName).trim();
                  if (m.type === 'system') {
                    const isJoin = /đã vào phòng|đã tham gia/i.test(m.payload || '');
                    const isCreated = /đã được tạo|đã tạo/i.test(m.payload || '');
                    return (
                      <div key={m.id} className="watch-party-msg watch-party-msg-system">
                        <i className={`fas ${isCreated ? 'fa-magic' : isJoin ? 'fa-check-circle' : 'fa-info-circle'}`} />
                        <span className="watch-party-msg-system-text">{m.payload}</span>
                      </div>
                    );
                  }
                  if (m.type === 'reaction' || m.type === 'text') {
                    return (
                      <div key={m.id} className={`watch-party-msg-bubble-wrap ${isMe ? 'is-me' : ''}`}>
                        {!isMe && (
                          <span className="watch-party-msg-avatar" title={m.userName}>
                            {(m.userName || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="watch-party-msg-bubble-content">
                          <span className="watch-party-msg-username">{m.userName || 'Thành viên'}</span>
                          <div className="watch-party-msg-bubble">
                            {m.type === 'reaction' ? (
                              <span className="watch-party-msg-emoji">{m.payload}</span>
                            ) : (
                              <span className="watch-party-msg-text">{m.payload}</span>
                            )}
                          </div>
                        </div>
                        {isMe && (
                          <span className="watch-party-msg-avatar" title={m.userName}>
                            {(m.userName || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
              <div className="watch-party-reactions">
                <span className="watch-party-reactions-label">Phản ứng:</span>
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="watch-party-emoji-btn"
                    onClick={() => sendReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <form onSubmit={sendMessage} className="watch-party-chat-form">
                <input
                  type="text"
                  className="watch-party-input watch-party-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Nhắn tin..."
                />
                <button type="submit" className="watch-party-btn watch-party-send-btn" aria-label="Gửi">
                  <i className="fas fa-paper-plane" />
                </button>
              </form>
            </div>
          )}

          {sidebarTab === 'playlist' && (
            <div className="watch-party-playlist">
              <h4 className="watch-party-playlist-title">Playlist Phim</h4>
              {playlist.length === 0 ? (
                <p className="watch-party-playlist-empty">Chưa có phim nào.</p>
              ) : (
                <ul className="watch-party-playlist-list">
                  {playlist.map((item, i) => (
                    <li
                      key={i}
                      className={`watch-party-playlist-item ${i === playIndex ? 'active' : ''}`}
                      onClick={() => playPlaylistIndex(i)}
                    >
                      <span>{item.title ? (typeof item.title === 'string' ? toTitleCase(item.title) : item.title) : 'Phim'}</span>
                      {i === playIndex && <span className="watch-party-now-playing">ĐANG PHÁT</span>}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="watch-party-btn watch-party-add-playlist" onClick={openAddPlaylistModal}>
                <i className="fas fa-plus" /> Thêm phim vào playlist
              </button>
              <div className="watch-party-reactions">
                <span className="watch-party-reactions-label">Phản ứng:</span>
                {REACTIONS.map((emoji) => (
                  <button key={emoji} type="button" className="watch-party-emoji-btn" onClick={() => sendReaction(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
              <form onSubmit={sendMessage} className="watch-party-chat-form">
                <input
                  type="text"
                  className="watch-party-input watch-party-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Nhắn tin..."
                />
                <button type="submit" className="watch-party-btn watch-party-send-btn" aria-label="Gửi">
                  <i className="fas fa-paper-plane" />
                </button>
              </form>
            </div>
          )}

          {sidebarTab === 'settings' && (
            <div className="watch-party-settings">
              <div className="watch-party-settings-card">
                <h4>Phòng của bạn</h4>
                <p>Mã phòng: <strong className="watch-party-room-code-inline">{code}</strong></p>
                <button type="button" className="watch-party-btn watch-party-btn-ghost" onClick={copyCode}>
                  <i className="fas fa-copy" /> Copy để chia sẻ
                </button>
              </div>
              <div className="watch-party-settings-card">
                <h4>Cài đặt đồng bộ</h4>
                <label className="watch-party-checkbox">
                  <input
                    type="checkbox"
                    checked={syncSettings.autoSyncThreshold !== undefined ? syncSettings.autoSyncThreshold > 0 : true}
                    onChange={(e) => updateSyncSettings('autoSyncThreshold', e.target.checked ? 5 : 0)}
                  />
                  Tự động đồng bộ khi lệch &gt;5s
                </label>
                <label className="watch-party-checkbox">
                  <input
                    type="checkbox"
                    checked={syncSettings.notifyOnPause !== false}
                    onChange={(e) => updateSyncSettings('notifyOnPause', e.target.checked)}
                  />
                  Thông báo khi ai pause
                </label>
              </div>
              <button type="button" className="watch-party-btn watch-party-btn-leave watch-party-btn-block" onClick={leaveRoom}>
                <i className="fas fa-sign-out-alt" /> Rời phòng
              </button>
              <div className="watch-party-reactions">
                <span className="watch-party-reactions-label">Phản ứng:</span>
                {REACTIONS.map((emoji) => (
                  <button key={emoji} type="button" className="watch-party-emoji-btn" onClick={() => sendReaction(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
              <form onSubmit={sendMessage} className="watch-party-chat-form">
                <input
                  type="text"
                  className="watch-party-input watch-party-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Nhắn tin..."
                />
                <button type="submit" className="watch-party-btn watch-party-send-btn" aria-label="Gửi">
                  <i className="fas fa-paper-plane" />
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>

      <AddToPlaylistModal
        isOpen={addPlaylistModalOpen}
        onClose={() => setAddPlaylistModalOpen(false)}
        onAdd={handleAddToPlaylist}
      />
    </div>
  );
}
