import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { user as userApi } from '../api/client';
import AvatarPickerModal from './AvatarPickerModal';

export default function ProfileModal({ open, onClose }) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'password' | 'notifications'
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [notifPhimMoi, setNotifPhimMoi] = useState(true);
  const [notifTapMoi, setNotifTapMoi] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setAvatarPreview(user?.avatar || '');
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    setNotifLoading(true);
    userApi.notificationSettings()
      .then((r) => {
        const d = r.data || {};
        setNotifPhimMoi(!!d.phim_moi);
        setNotifTapMoi(!!d.tap_moi);
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, [open, user]);

  useEffect(() => {
    if (!open || !user) return;
    setLoadingStats(true);
    userApi.stats()
      .then((r) => {
        const d = r.data || {};
        setFavoritesCount(d.favoritesCount ?? 0);
        setHistoryCount(d.historyCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [open, user]);

  const handleAvatarClick = () => fileInputRef.current?.click();

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
      const msg = err.response?.data?.error || 'Tải avatar thất bại';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setSavingProfile(true);
    try {
      await userApi.updateProfile({ name: name.trim() });
      refreshUser?.();
      toast.success('Đã cập nhật tên.');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Cập nhật thất bại';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleNotifToggle = async (key, value) => {
    const setters = { phim_moi: setNotifPhimMoi, tap_moi: setNotifTapMoi };
    setters[key]?.(value);
    setNotifSaving(true);
    try {
      await userApi.updateNotificationSettings({ [key]: value });
      toast.success('Đã cập nhật.');
    } catch (err) {
      setters[key]?.(!value);
      toast.error(err.response?.data?.error || 'Cập nhật thất bại');
    } finally {
      setNotifSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      const msg = 'Mật khẩu mới tối thiểu 6 ký tự';
      setPasswordError(msg);
      toast.error(msg);
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = 'Mật khẩu xác nhận không khớp';
      setPasswordError(msg);
      toast.error(msg);
      return;
    }
    setSavingPassword(true);
    try {
      await userApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Đổi mật khẩu thành công.');
    } catch (err) {
      const msg = err.response?.data?.error || 'Đổi mật khẩu thất bại';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  if (!open) return null;

  const content = (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <div className="modal profile-modal profile-modal-centered" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-head">
          <h2 id="profile-modal-title">Thông tin cá nhân</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="profile-modal-body">
          <div className="profile-modal-avatar-section">
            <button
              type="button"
              className="profile-modal-avatar-wrap"
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              aria-label="Đổi avatar"
            >
              <div className="profile-modal-avatar-preview">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : null}
                {!avatarPreview && (
                  <span className="profile-modal-avatar-placeholder">{name?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <span className="profile-modal-avatar-hint">
                {uploadingAvatar ? 'Đang tải...' : 'Click để đổi avatar'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="profile-modal-avatar-input"
                onChange={handleAvatarFile}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              className="profile-modal-avatar-preset-btn"
              onClick={() => setAvatarPickerOpen(true)}
              aria-label="Chọn ảnh có sẵn"
            >
              <span className="profile-modal-avatar-preset-icon" aria-hidden>
                <i className="fas fa-th" />
              </span>
              <span className="profile-modal-avatar-preset-label">Ảnh có sẵn</span>
            </button>
          </div>

          <AvatarPickerModal
            open={avatarPickerOpen}
            onClose={() => setAvatarPickerOpen(false)}
            currentAvatarUrl={avatarPreview}
            onSave={handleSavePresetAvatar}
          />

          <form onSubmit={handleSaveProfile} className="profile-modal-form profile-modal-form-name">
            <label className="profile-modal-label">Tên hiển thị</label>
            <input
              type="text"
              className="profile-modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên của bạn"
            />
            {profileError && <p className="profile-modal-error">{profileError}</p>}
            <div className="modal-actions modal-actions-center">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Đang lưu...' : 'Lưu tên'}
              </button>
            </div>
          </form>

          <div className="profile-modal-tabs">
            <button
              type="button"
              className={`profile-modal-tab ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              Thống kê
            </button>
            <button
              type="button"
              className={`profile-modal-tab ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              Thông báo
            </button>
            <button
              type="button"
              className={`profile-modal-tab ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              Đổi mật khẩu
            </button>
          </div>

          {activeTab === 'stats' && (
            <div className="profile-modal-tab-panel">
              {loadingStats ? (
                <p className="profile-modal-muted">Đang tải...</p>
              ) : (
                <div className="profile-modal-stats-grid">
                  <div className="profile-modal-stat">
                    <span className="profile-modal-stat-value">{favoritesCount}</span>
                    <span className="profile-modal-stat-label">Phim yêu thích</span>
                  </div>
                  <div className="profile-modal-stat">
                    <span className="profile-modal-stat-value">{historyCount}</span>
                    <span className="profile-modal-stat-label">Phim đã xem</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="profile-modal-tab-panel profile-modal-notifications">
              <div className="profile-modal-notif-head">
                <i className="fas fa-bell profile-modal-notif-icon" />
                <span>Thông báo</span>
              </div>
              {notifLoading ? (
                <p className="profile-modal-muted">Đang tải...</p>
              ) : (
                <div className="profile-modal-notif-list">
                  <div className="profile-modal-notif-row">
                    <span className="profile-modal-notif-label">Phim mới cập nhật</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifPhimMoi}
                      className={`profile-modal-notif-toggle ${notifPhimMoi ? 'on' : ''}`}
                      onClick={() => handleNotifToggle('phim_moi', !notifPhimMoi)}
                      disabled={notifSaving}
                    >
                      <span className="profile-modal-notif-toggle-thumb" />
                    </button>
                  </div>
                  <div className="profile-modal-notif-row">
                    <span className="profile-modal-notif-label">Tập mới phim bộ</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifTapMoi}
                      className={`profile-modal-notif-toggle ${notifTapMoi ? 'on' : ''}`}
                      onClick={() => handleNotifToggle('tap_moi', !notifTapMoi)}
                      disabled={notifSaving}
                    >
                      <span className="profile-modal-notif-toggle-thumb" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'password' && (
            <div className="profile-modal-tab-panel">
              <form onSubmit={handleChangePassword} className="profile-modal-form profile-modal-password">
                <label className="profile-modal-label">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  className="profile-modal-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <label className="profile-modal-label">Mật khẩu mới</label>
                <input
                  type="password"
                  className="profile-modal-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                />
                <label className="profile-modal-label">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  className="profile-modal-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                {passwordError && <p className="profile-modal-error">{passwordError}</p>}
                {passwordSuccess && <p className="profile-modal-success">Đổi mật khẩu thành công.</p>}
                <div className="modal-actions modal-actions-center">
                  <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                    {savingPassword ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
