import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api/client';
import { imageDisplayUrl, NO_POSTER_DATA_URL } from '../../utils/imageUrl.js';
import { formatRelativeTimeGMT7 } from '../../utils/dateGMT7.js';
import { toTitleCase } from '../../utils/titleCase.js';
import { getApiBase } from '../../context/PublicSettingsContext';
import { useToast } from '../../context/ToastContext';

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function formatNumber(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}


function ViewsChart({ data, period }) {
  const maxViews = Math.max(1, ...data.map((d) => d.views));
  const maxUsers = Math.max(1, ...data.map((d) => d.newUsers));
  const maxVal = Math.max(maxViews, maxUsers);
  const days = data.length;
  const width = 100;
  const height = 120;

  const toY = (v) => height - (v / maxVal) * (height - 16);
  const toX = (i) => (i / (days - 1 || 1)) * width;

  const pointsViews = data.map((d, i) => `${toX(i)},${toY(d.views)}`).join(' ');
  const pointsUsers = data.map((d, i) => `${toX(i)},${toY(d.newUsers)}`).join(' ');

  const dayLabels = period === 7
    ? DAY_LABELS
    : data.length <= 7
      ? data.map((d) => d.date.slice(5))
      : [];
  const xLabels = period === 7 ? dayLabels : (() => {
    if (data.length === 0) return [];
    const step = Math.max(1, Math.floor(data.length / 6));
    return data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d) => d.date.slice(5));
  })();

  return (
    <div className="dashboard-chart">
      <div className="dashboard-chart-svg-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="dashboard-chart-svg">
          <defs>
            <linearGradient id="grad-views" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="grad-users" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <line key={p} x1="0" y1={height - p * (height - 16)} x2={width} y2={height - p * (height - 16)} className="chart-grid" />
          ))}
          {/* Area + line views */}
          <polygon points={`0,${height} ${pointsViews} ${width},${height}`} fill="url(#grad-views)" />
          <polyline points={pointsViews} fill="none" stroke="var(--accent)" strokeWidth="1.5" className="chart-line" />
          {data.map((d, i) => (
            <circle key={i} cx={toX(i)} cy={toY(d.views)} r="1.5" fill="var(--accent)" />
          ))}
          {/* Area + line new users */}
          <polygon points={`0,${height} ${pointsUsers} ${width},${height}`} fill="url(#grad-users)" />
          <polyline points={pointsUsers} fill="none" stroke="#3b82f6" strokeWidth="1.5" className="chart-line" />
          {data.map((d, i) => (
            <circle key={i} cx={toX(i)} cy={toY(d.newUsers)} r="1.5" fill="#3b82f6" />
          ))}
        </svg>
      </div>
      <div className="dashboard-chart-x">
        {(period === 7 ? dayLabels : xLabels).map((l, i) => (
          <span key={i}>{l || '—'}</span>
        ))}
      </div>
      <div className="dashboard-chart-legend">
        <span><i className="legend-dot accent" /> Lượt xem (triệu)</span>
        <span><i className="legend-dot blue" /> Người dùng mới (nghìn)</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const apiBase = getApiBase();
  const [stats, setStats] = useState(null);
  const [viewsByDay, setViewsByDay] = useState([]);
  const [chartPeriod, setChartPeriod] = useState(7);
  const [topMovies, setTopMovies] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRecentUsers = () => admin.recentUsers(5).then((r) => r.data);

  useEffect(() => {
    Promise.all([
      admin.stats().then((r) => r.data),
      admin.viewsByDay(chartPeriod).then((r) => r.data),
      admin.topMovies(5).then((r) => r.data),
      loadRecentUsers(),
      admin.activity(8).then((r) => r.data),
    ])
      .then(([s, v, t, u, a]) => {
        setStats(s);
        setViewsByDay(v);
        setTopMovies(t);
        setRecentUsers(u);
        setActivity(a);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) {
      admin.viewsByDay(chartPeriod).then((r) => setViewsByDay(r.data)).catch(() => {});
    }
  }, [chartPeriod, loading]);

  const handleToggleLock = async (u) => {
    if (u.role === 'admin') {
      toast.error('Không thể khóa tài khoản admin');
      return;
    }
    const nextStatus = (u.status || 'active') === 'active' ? 'locked' : 'active';
    try {
      await admin.updateUserStatus(u.id, nextStatus);
      const list = await loadRecentUsers();
      setRecentUsers(list);
      toast.success(nextStatus === 'locked' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không thể đổi trạng thái');
    }
  };

  const avatarUrl = (u) => {
    if (!u.avatar || typeof u.avatar !== 'string') return null;
    const s = u.avatar.trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return `${apiBase}${s.startsWith('/') ? s : '/' + s}`;
  };

  if (loading || !stats) return <p className="loading-wrap">Đang tải...</p>;

  return (
    <div className="dashboard">
      {/* Thẻ thống kê */}
      <div className="dashboard-cards">
        <div className="dashboard-card accent-orange">
          <i className="fas fa-eye dashboard-card-icon" />
          <span className="dashboard-card-value">{stats.viewsToday?.toLocaleString('vi') ?? stats.totalViews?.toLocaleString('vi')}</span>
          <span className="dashboard-card-label">Lượt xem hôm nay</span>
          <span className="dashboard-card-change">
            <i className="fas fa-square" aria-hidden /> +{stats.percentViews ?? 0}% so với hôm qua
          </span>
        </div>
        <div className="dashboard-card accent-green">
          <i className="fas fa-users dashboard-card-icon" />
          <span className="dashboard-card-value">{stats.users?.toLocaleString('vi')}</span>
          <span className="dashboard-card-label">Người dùng hoạt động</span>
          <span className="dashboard-card-change">
            <i className="fas fa-square" aria-hidden /> +{stats.newUsersToday ?? 0} đăng ký hôm nay
          </span>
        </div>
        <div className="dashboard-card accent-blue">
          <i className="fas fa-film dashboard-card-icon" />
          <span className="dashboard-card-value">{stats.movies?.toLocaleString('vi')}</span>
          <span className="dashboard-card-label">Tổng số phim</span>
          <span className="dashboard-card-change">
            <i className="fas fa-square" aria-hidden /> +{stats.newMoviesThisMonth ?? 0} phim tháng này
          </span>
        </div>
        </div>

      {/* Biểu đồ lượt xem theo ngày */}
      <div className="dashboard-section dashboard-chart-section">
        <h2 className="dashboard-section-title">Lượt xem theo ngày</h2>
        <div className="dashboard-chart-tabs">
          {[7, 30, 90].map((p) => (
            <button
              key={p}
              type="button"
              className={chartPeriod === p ? 'active' : ''}
              onClick={() => setChartPeriod(p)}
            >
              {p === 7 ? '7 ngày' : p === 30 ? '30 ngày' : '3 tháng'}
            </button>
          ))}
        </div>
        <ViewsChart data={viewsByDay} period={chartPeriod} />
      </div>

      <div className="dashboard-grid-2">
        {/* Top phim hôm nay */}
        <div className="dashboard-section">
          <div className="dashboard-section-head">
            <h2 className="dashboard-section-title with-bar">Top phim hôm nay</h2>
            <Link to="/admin/movies" className="dashboard-link">Xem tất cả</Link>
          </div>
          <ul className="dashboard-top-movies">
            {topMovies.length === 0 ? (
              <li className="dashboard-empty">Chưa có dữ liệu</li>
            ) : (
              topMovies.map((m, i) => (
                <li key={m.id} className="dashboard-top-item">
                  <span className={`dashboard-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
                  <img src={imageDisplayUrl(m.poster) || NO_POSTER_DATA_URL} alt="" className="dashboard-top-poster" />
                  <div className="dashboard-top-info">
                    <span className="dashboard-top-title">{toTitleCase(m.title)}</span>
                    <span className="dashboard-top-meta">{({ movie: 'Phim lẻ', series: 'Phim bộ', anime: 'Anime', tvshows: 'TV Shows' })[m.type] || 'Phim lẻ'}</span>
                  </div>
                  <span className={`dashboard-top-value ${i < 3 ? 'top' : ''}`}>{formatNumber(m.view_count_day ?? m.view_count ?? 0)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Hoạt động gần đây */}
        <div className="dashboard-section">
          <div className="dashboard-section-head">
            <h2 className="dashboard-section-title with-bar">Hoạt động gần đây</h2>
            <span className="dashboard-realtime-badge">Realtime</span>
          </div>
          <ul className="dashboard-activity">
            {stats.viewsToday > 0 && (
              <li className="dashboard-activity-item">
                <span className="dashboard-activity-dot blue" />
                <span className="dashboard-activity-text">{stats.viewsToday.toLocaleString('vi')} lượt xem đang diễn ra</span>
                <span className="dashboard-activity-time">Bây giờ</span>
              </li>
            )}
            {activity.length === 0 && !(stats.viewsToday > 0) ? (
              <li className="dashboard-empty">Chưa có hoạt động</li>
            ) : (
              activity.map((a, i) => (
                <li key={i} className="dashboard-activity-item">
                  <span className={`dashboard-activity-dot ${a.color || 'blue'}`} />
                  <span className="dashboard-activity-text">{a.text}</span>
                  <span className="dashboard-activity-time">{formatRelativeTimeGMT7(a.at)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Người dùng mới đăng ký */}
      <div className="dashboard-section">
        <div className="dashboard-section-head">
          <h2 className="dashboard-section-title with-bar">Người dùng mới đăng ký</h2>
          <Link to="/admin/users" className="dashboard-link">Xem tất cả</Link>
        </div>
        <div className="dashboard-table-wrap">
          <table className="admin-table dashboard-users-table">
            <thead>
              <tr>
                <th>NGƯỜI DÙNG</th>
                <th>EMAIL</th>
                <th>ROLE</th>
                <th>TRẠNG THÁI</th>
                <th>THAM GIA</th>
                <th>HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.length === 0 ? (
                <tr><td colSpan={6} className="dashboard-empty">Chưa có người dùng</td></tr>
              ) : (
                recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="dashboard-user-cell">
                        <span className="dashboard-user-avatar" style={{ background: avatarUrl(u) ? 'transparent' : `hsl(${(u.id * 60) % 360}, 50%, 45%)` }}>
                          {avatarUrl(u) ? (
                            <img src={avatarUrl(u)} alt="" />
                          ) : (
                            u.name?.charAt(0)?.toUpperCase() || '?'
                          )}
                        </span>
                        <span>{u.name}</span>
                      </div>
                    </td>
                    <td>{u.email || '-'}</td>
                    <td><span className={`badge ${u.role === 'admin' ? 'admin' : 'user'}`}>{u.role === 'admin' ? 'ADMIN' : 'USER'}</span></td>
                    <td><span className={`badge status-${u.status || 'active'}`}>{(u.status || 'active') === 'locked' ? 'Đã khóa' : 'Hoạt động'}</span></td>
                    <td>{formatRelativeTimeGMT7(u.created_at)}</td>
                    <td>
                      <div className="dashboard-actions">
                        <Link to="/admin/users" className="dashboard-action-btn" aria-label="Xem chi tiết" title="Xem chi tiết"><i className="fas fa-eye" /></Link>
                        <button
                          type="button"
                          className="dashboard-action-btn"
                          aria-label={(u.status || 'active') === 'active' ? 'Khóa' : 'Mở khóa'}
                          title={(u.status || 'active') === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
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
        </div>
      </div>
    </div>
  );
}
