import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { settings as settingsApi } from '../api/client';

/**
 * Khi bật chế độ bảo trì: hiển thị thông báo toàn màn hình cho người dùng.
 * Trang /admin/* vẫn truy cập được để quản trị có thể tắt bảo trì.
 */
export default function MaintenanceGate({ children }) {
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const fetchMaintenance = () => {
    setLoading(true);
    settingsApi
      .getPublic()
      .then((r) => setMaintenance(!!r.data?.maintenance_mode))
      .catch(() => setMaintenance(false))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMaintenance();
  }, []);

  if (loading) return children;

  const isAdminPath = location.pathname.startsWith('/admin');
  if (maintenance && !isAdminPath) {
    return (
      <div className="maintenance-page" role="alert">
        <div className="maintenance-page-inner">
          <div className="maintenance-page-icon" aria-hidden>
            <i className="fas fa-tools" />
          </div>
          <h1 className="maintenance-page-title">Website đang bảo trì</h1>
          <p className="maintenance-page-desc">
            Hệ thống đang được nâng cấp, vui lòng quay lại sau. Xin cảm ơn!
          </p>
          <div className="maintenance-page-actions">
            <button type="button" className="maintenance-page-retry-btn" onClick={fetchMaintenance}>
              Thử lại
            </button>
            <Link to="/admin" className="maintenance-page-admin-link">
              Đăng nhập quản trị
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
