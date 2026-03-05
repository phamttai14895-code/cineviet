import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { user as userApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import AvatarPickerModal from '../components/AvatarPickerModal';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('favorites');
  const [loading, setLoading] = useState(true);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setAvatarPreview(user?.avatar || '');
  }, [user?.avatar]);

  useEffect(() => {
    Promise.all([userApi.favorites(), userApi.history()])
      .then(([fav, hist]) => {
        setFavorites(fav.data || []);
        const raw = hist.data || [];
        const seen = new Set();
        const deduped = raw.filter((m) => {
          if (!m || !m.id) return false;
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        setHistory(deduped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSavePresetAvatar = async (avatarUrl) => {
    await userApi.updateProfile({ avatar: avatarUrl });
    setAvatarPreview(avatarUrl);
    refreshUser?.();
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await userApi.uploadAvatar(formData);
      setAvatarPreview(data?.avatar || '');
      refreshUser?.();
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) return <div className="container loading-wrap">Đang tải...</div>;

  return (
    <div className="container profile-page" style={{ padding: '40px 0' }}>
      <div className="profile-page-avatar-block">
        <div className="profile-page-avatar-wrap">
          <button
            type="button"
            className="profile-page-avatar-preview-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Đổi avatar (tải ảnh lên)"
          >
            <div className="profile-page-avatar-preview">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
              ) : null}
              {!avatarPreview && (
                <span className="profile-page-avatar-placeholder">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
            onChange={handleAvatarFile}
            aria-hidden="true"
          />
          <p className="profile-page-avatar-hint">Click để đổi avatar</p>
          <button
            type="button"
            className="profile-page-avatar-preset-btn"
            onClick={() => setAvatarPickerOpen(true)}
            aria-label="Chọn ảnh có sẵn"
          >
            <span className="profile-page-avatar-preset-icon" aria-hidden>
              <i className="fas fa-th" />
            </span>
            <span className="profile-page-avatar-preset-label">Ảnh có sẵn</span>
          </button>
        </div>
      </div>
      <AvatarPickerModal
        open={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        currentAvatarUrl={avatarPreview}
        onSave={handleSavePresetAvatar}
      />

      <h1 className="page-title">Yêu thích/Đã xem</h1>
      <div className="tabs">
        <button
          type="button"
          className={tab === 'favorites' ? 'active' : ''}
          onClick={() => setTab('favorites')}
        >
          Yêu thích ({favorites.length})
        </button>
        <button
          type="button"
          className={tab === 'history' ? 'active' : ''}
          onClick={() => setTab('history')}
        >
          Đã xem ({history.length})
        </button>
      </div>
      {tab === 'favorites' && (
        favorites.length === 0 ? (
          <p className="profile-empty">Chưa có phim yêu thích. <Link to="/">Xem phim</Link> và nhấn Thích trên trang phim.</p>
        ) : (
          <div className="movie-grid" style={{ marginTop: '24px' }}>
            {favorites.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        )
      )}
      {tab === 'history' && (
        history.length === 0 ? (
          <p className="profile-empty">Chưa xem phim nào.</p>
        ) : (
          <div className="movie-grid" style={{ marginTop: '24px' }}>
            {history.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
