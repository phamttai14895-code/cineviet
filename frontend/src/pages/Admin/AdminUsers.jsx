import { useState, useEffect, useRef } from 'react';
import { admin } from '../../api/client';
import { formatRelativeTimeGMT7 } from '../../utils/dateGMT7.js';
import { useToast } from '../../context/ToastContext';

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewingUser, setViewingUser] = useState(null);
  const isFirstSearch = useRef(true);

  const load = () => {
    setLoading(true);
    const params = search.trim() ? { search: search.trim() } : {};
    admin.users(params).then((r) => setUsers(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (isFirstSearch.current) {
      isFirstSearch.current = false;
      return;
    }
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleToggleLock = async (u) => {
    if (u.role === 'admin') {
      toast.error('Không thể khóa tài khoản admin');
      return;
    }
    const nextStatus = (u.status || 'active') === 'active' ? 'locked' : 'active';
    try {
      await admin.updateUserStatus(u.id, nextStatus);
      load();
      toast.success(nextStatus === 'locked' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Không thể đổi trạng thái');
    }
  };

  return (
    <div className="admin-users-page">
      <div className="admin-users-header">
        <h1 className="admin-users-title with-bar">Quản lý người dùng</h1>
        <input
          type="search"
          placeholder="Tìm theo email/tên..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-users-search"
        />
      </div>

      <div className="admin-users-table-wrap">
        {loading ? (
          <p className="loading-wrap">Đang tải...</p>
        ) : (
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>NGƯỜI DÙNG</th>
                <th>EMAIL</th>
                <th>ROLE</th>
                <th>TRẠNG THÁI</th>
                <th>ĐÃ XEM</th>
                <th>THAM GIA</th>
                <th>HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-users-empty">
                    Không tìm thấy người dùng nào.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-users-cell-user">
                        <span
                          className="admin-users-avatar"
                          style={{ background: `hsl(${(u.id * 60) % 360}, 50%, 45%)` }}
                        >
                          {u.avatar ? (
                            <img src={u.avatar} alt="" />
                          ) : (
                            (u.name || '?').charAt(0).toUpperCase()
                          )}
                        </span>
                        <span className="admin-users-name">{u.name}</span>
                      </div>
                    </td>
                    <td>{u.email || '—'}</td>
                    <td>
                      {u.role === 'admin' ? (
                        <span className="admin-users-badge admin-users-badge-admin">ADMIN</span>
                      ) : (
                        <span className="admin-users-badge admin-users-badge-user">USER</span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-users-badge admin-users-status-${u.status || 'active'}`}>
                        {(u.status || 'active') === 'locked' ? 'Đã khóa' : 'Hoạt động'}
                      </span>
                    </td>
                    <td>{u.watched_count ?? 0} phim</td>
                    <td>{formatRelativeTimeGMT7(u.created_at)}</td>
                    <td>
                      <div className="admin-users-actions-cell">
                        <button
                          type="button"
                          className="admin-users-action-btn"
                          title="Xem chi tiết"
                          onClick={() => setViewingUser(u)}
                        >
                          <i className="fas fa-eye" />
                        </button>
                        <button
                          type="button"
                          className="admin-users-action-btn"
                          title={(u.status || 'active') === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                          onClick={() => handleToggleLock(u)}
                          disabled={u.role === 'admin'}
                        >
                          <i className={`fas fa-${(u.status || 'active') === 'locked' ? 'lock-open' : 'lock'}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {viewingUser && (
        <div className="modal-overlay" onClick={() => setViewingUser(null)}>
          <div className="modal admin-user-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Chi tiết người dùng</h2>
            <div className="admin-user-detail">
              <div className="admin-user-detail-row">
                <span className="admin-user-detail-avatar" style={{ background: `hsl(${(viewingUser.id * 60) % 360}, 50%, 45%)` }}>
                  {viewingUser.avatar ? <img src={viewingUser.avatar} alt="" /> : (viewingUser.name || '?').charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong>{viewingUser.name}</strong>
                  <p className="muted">{viewingUser.email || '—'}</p>
                </div>
              </div>
              <p><span className="label">Vai trò:</span> {viewingUser.role === 'admin' ? 'ADMIN' : 'USER'}</p>
              <p><span className="label">Trạng thái:</span> {(viewingUser.status || 'active') === 'locked' ? 'Đã khóa' : 'Hoạt động'}</p>
              <p><span className="label">Đã xem:</span> {viewingUser.watched_count ?? 0} phim</p>
              <p><span className="label">Tham gia:</span> {formatRelativeTimeGMT7(viewingUser.created_at)}</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewingUser(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
