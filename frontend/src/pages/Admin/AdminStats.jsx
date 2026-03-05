import { useState, useEffect } from 'react';
import { admin } from '../../api/client';

const REFRESH_INTERVAL_MS = 15000;

export default function AdminStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = () => {
    admin
      .vpsStats()
      .then((r) => {
        setData(r.data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Không tải được thống kê VPS');
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  if (loading && !data) return <p className="loading-wrap">Đang tải...</p>;
  if (error && !data) {
    return (
      <div className="admin-stats-page">
        <p className="admin-stats-error" role="alert">{error}</p>
        <button type="button" className="watch-party-btn watch-party-btn-primary" onClick={fetchStats}>Thử lại</button>
      </div>
    );
  }

  const d = data || {};
  const ramUsed = d.ramUsedGb ?? 0;
  const ramTotal = d.ramTotalGb ?? 0;
  const diskUsed = d.diskUsedGb ?? 0;
  const diskTotal = d.diskTotalGb ?? 0;

  return (
    <div className="admin-stats-page">
      <h1 className="admin-stats-title">Thống kê VPS</h1>
      <p className="admin-stats-subtitle">Quản lý tài nguyên server • Tự làm mới mỗi 15 giây</p>

      <div className="admin-stats-grid">
        <div className="admin-stats-card admin-stats-card-blue">
          <span className="admin-stats-card-label">ĐANG XEM TRỰC TIẾP</span>
          <span className="admin-stats-card-value">{d.liveWatching ?? 0}</span>
        </div>

        <div className="admin-stats-card admin-stats-card-cyan">
          <span className="admin-stats-card-label">TỔNG SỐ PHIM</span>
          <span className="admin-stats-card-value">{d.totalMovies ?? 0}</span>
        </div>

        <div className="admin-stats-card admin-stats-card-cyan">
          <span className="admin-stats-card-label">CẬP NHẬT HÔM NAY</span>
          <span className="admin-stats-card-value">{d.updatedToday ?? 0}</span>
        </div>

        <div className="admin-stats-card admin-stats-card-cyan">
          <span className="admin-stats-card-label">BĂNG THÔNG</span>
          <span className="admin-stats-card-value">{(d.bandwidthMbps ?? 0).toFixed(1)} Mbps</span>
        </div>

        <div className="admin-stats-card admin-stats-card-yellow">
          <span className="admin-stats-card-label">RAM</span>
          <span className="admin-stats-card-meta">{ramUsed.toFixed(2)} / {ramTotal.toFixed(2)} GB</span>
          <span className="admin-stats-card-value">{d.ramPercent ?? 0}%</span>
          <div className="admin-stats-progress">
            <div className="admin-stats-progress-fill admin-stats-progress-yellow" style={{ width: `${Math.min(100, d.ramPercent ?? 0)}%` }} />
          </div>
        </div>

        <div className="admin-stats-card admin-stats-card-green">
          <span className="admin-stats-card-label">Ổ ĐĨA</span>
          <span className="admin-stats-card-meta">{diskUsed.toFixed(0)} / {diskTotal.toFixed(1)} GB</span>
          <span className="admin-stats-card-value">{d.diskPercent ?? 0}%</span>
          <div className="admin-stats-progress">
            <div className="admin-stats-progress-fill admin-stats-progress-green" style={{ width: `${Math.min(100, d.diskPercent ?? 0)}%` }} />
          </div>
        </div>

        <div className="admin-stats-card admin-stats-card-cpu">
          <span className="admin-stats-card-label">
            <i className="fas fa-microchip admin-stats-cpu-icon" aria-hidden /> Tải CPU
          </span>
          <span className="admin-stats-card-value">{d.cpuPercent ?? 0}%</span>
        </div>
      </div>
    </div>
  );
}
