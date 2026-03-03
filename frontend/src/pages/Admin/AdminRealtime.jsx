import { useState, useEffect } from 'react';
import { admin } from '../../api/client';

function ago(lastSeen) {
  if (lastSeen == null) return '—';
  const ms = typeof lastSeen === 'number' ? lastSeen : new Date(lastSeen).getTime();
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return `${sec}s trước`;
  const min = Math.floor(sec / 60);
  return `${min} phút trước`;
}

export default function AdminRealtime() {
  const [viewers, setViewers] = useState([]);
  const [stats, setStats] = useState({ totalViewers: 0, byMovie: {} });
  const [loading, setLoading] = useState(true);

  const fetchRealtime = () => {
    admin
      .realtime()
      .then((r) => {
        setViewers(r.data?.viewers || []);
        setStats(r.data?.stats || { totalViewers: 0, byMovie: {} });
      })
      .catch(() => {
        setViewers([]);
        setStats({ totalViewers: 0, byMovie: {} });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRealtime();
    const t = setInterval(fetchRealtime, 5000);
    return () => clearInterval(t);
  }, []);

  // Cập nhật "X giây trước" mỗi giây cho mượt
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="admin-realtime-page">
      <div className="admin-page-head admin-realtime-head">
        <h1>Real-time</h1>
        <span className="admin-live-badge">LIVE</span>
      </div>

      <div className="admin-realtime-stats">
        <div className="admin-realtime-stat-card">
          <span className="admin-realtime-stat-value">{stats.totalViewers}</span>
          <span className="admin-realtime-stat-label">Lượt xem trực tiếp</span>
        </div>
      </div>

      <div className="admin-realtime-section">
        <h2 className="admin-realtime-section-title">Người dùng đang xem</h2>
        <div className="admin-realtime-table-wrap">
          {loading && viewers.length === 0 ? (
            <p className="admin-realtime-empty">Đang tải...</p>
          ) : viewers.length === 0 ? (
            <p className="admin-realtime-empty">Chưa có ai đang xem. Khi user mở trang xem phim, heartbeat mỗi 15s sẽ hiển thị tại đây.</p>
          ) : (
            <table className="admin-table admin-realtime-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Phim đang xem</th>
                  <th>Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {viewers.map((v, i) => (
                  <tr key={`${v.userId}-${v.movieId}-${i}`}>
                    <td>{v.userName}</td>
                    <td>{v.movieTitle}</td>
                    <td>{ago(v.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
