import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { admin } from '../../api/client';
import AdminDashboard from './AdminDashboard';
import AdminMovies from './AdminMovies';
import AdminAddMovie from './AdminAddMovie';
import AdminEditMovie from './AdminEditMovie';
import AdminUsers from './AdminUsers';
import AdminGenres from './AdminGenres';
import AdminCountries from './AdminCountries';
import AdminDirectors from './AdminDirectors';
import AdminActors from './AdminActors';
import AdminReleaseYears from './AdminReleaseYears';
import AdminRealtime from './AdminRealtime';
import AdminEpisodes from './AdminEpisodes';
import AdminComments from './AdminComments';
import AdminReports from './AdminReports';
import AdminSettings from './AdminSettings';
import AdminAds from './AdminAds';
import AdminLogs from './AdminLogs';
import AdminCrawl from './AdminCrawl';
import AdminStats from './AdminStats';

function AdminSidebarSection({ title, children }) {
  return (
    <div className="admin-sidebar-section">
      <span className="admin-sidebar-section-title">{title}</span>
      {children}
    </div>
  );
}

function AdminNavItem({ to, end, icon, children, badge, badgeType = 'red', onNavigate }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={onNavigate}>
      <i className={`fas fa-${icon} admin-nav-icon`} />
      <span>{children}</span>
      {badge != null && (
        <span className={`admin-nav-badge ${badgeType}`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function Admin() {
  const [reportedCommentsCount, setReportedCommentsCount] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refreshReportedCommentsCount = () => {
    admin.commentsReportedCount().then((r) => setReportedCommentsCount(r.data?.count ?? 0)).catch(() => {});
  };
  const refreshPendingReportsCount = () => {
    admin.reportsCount().then((r) => setPendingReportsCount(r.data?.pending ?? 0)).catch(() => {});
  };

  useEffect(() => {
    refreshReportedCommentsCount();
  }, []);
  useEffect(() => {
    refreshPendingReportsCount();
    const onReportsUpdated = () => refreshPendingReportsCount();
    window.addEventListener('admin-reports-updated', onReportsUpdated);
    return () => window.removeEventListener('admin-reports-updated', onReportsUpdated);
  }, []);
  useEffect(() => {
    const onCommentsUpdated = () => refreshReportedCommentsCount();
    window.addEventListener('admin-comments-updated', onCommentsUpdated);
    return () => window.removeEventListener('admin-comments-updated', onCommentsUpdated);
  }, []);

  return (
    <div className={`admin-layout ${sidebarOpen ? 'admin-drawer-open' : ''}`}>
      <div
        className="admin-drawer-backdrop"
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="admin-sidebar-logo">CINEVIET</span>
          <span className="admin-sidebar-subtitle">ADMIN DASHBOARD</span>
          <button
            type="button"
            className="admin-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng menu"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          <AdminSidebarSection title="TỔNG QUAN">
            <AdminNavItem to="/admin" end icon="gauge-high" onNavigate={() => setSidebarOpen(false)}>Dashboard</AdminNavItem>
            <AdminNavItem to="/admin/stats" icon="chart-pie" onNavigate={() => setSidebarOpen(false)}>Thống kê</AdminNavItem>
            <AdminNavItem to="/admin/realtime" icon="signal" badge="LIVE" badgeType="green" onNavigate={() => setSidebarOpen(false)}>Real-time</AdminNavItem>
          </AdminSidebarSection>

          <AdminSidebarSection title="NỘI DUNG">
            <AdminNavItem to="/admin/crawl" icon="cloud-download-alt" onNavigate={() => setSidebarOpen(false)}>Crawl phim</AdminNavItem>
            <AdminNavItem to="/admin/movies" icon="film" onNavigate={() => setSidebarOpen(false)}>Quản lý phim</AdminNavItem>
            <AdminNavItem to="/admin/movies/add" icon="plus" onNavigate={() => setSidebarOpen(false)}>Thêm phim mới</AdminNavItem>
            <AdminNavItem to="/admin/episodes" icon="list" onNavigate={() => setSidebarOpen(false)}>Danh sách tập</AdminNavItem>
            <AdminNavItem to="/admin/genres" icon="tags" onNavigate={() => setSidebarOpen(false)}>Thể loại</AdminNavItem>
            <AdminNavItem to="/admin/countries" icon="globe" onNavigate={() => setSidebarOpen(false)}>Quốc gia</AdminNavItem>
            <AdminNavItem to="/admin/directors" icon="video" onNavigate={() => setSidebarOpen(false)}>Đạo diễn</AdminNavItem>
            <AdminNavItem to="/admin/actors" icon="user-tie" onNavigate={() => setSidebarOpen(false)}>Diễn viên</AdminNavItem>
            <AdminNavItem to="/admin/release-years" icon="calendar" onNavigate={() => setSidebarOpen(false)}>Năm phát hành</AdminNavItem>
          </AdminSidebarSection>

          <AdminSidebarSection title="NGƯỜI DÙNG">
            <AdminNavItem to="/admin/users" icon="users" onNavigate={() => setSidebarOpen(false)}>Quản lý User</AdminNavItem>
            <AdminNavItem to="/admin/comments" icon="comments" badge={reportedCommentsCount > 0 ? reportedCommentsCount : undefined} onNavigate={() => setSidebarOpen(false)}>Bình luận</AdminNavItem>
            <AdminNavItem to="/admin/reports" icon="triangle-exclamation" badge={pendingReportsCount > 0 ? pendingReportsCount : undefined} onNavigate={() => setSidebarOpen(false)}>Báo cáo lỗi</AdminNavItem>
          </AdminSidebarSection>

          <AdminSidebarSection title="HỆ THỐNG">
            <AdminNavItem to="/admin/settings" icon="gears" onNavigate={() => setSidebarOpen(false)}>Cài đặt</AdminNavItem>
            <AdminNavItem to="/admin/ads" icon="ad" onNavigate={() => setSidebarOpen(false)}>Quản lý quảng cáo</AdminNavItem>
            <AdminNavItem to="/admin/logs" icon="file-lines" onNavigate={() => setSidebarOpen(false)}>Server Logs</AdminNavItem>
            <Link to="/" className="admin-nav-item" onClick={() => setSidebarOpen(false)}>
              <i className="fas fa-home admin-nav-icon" />
              <span>Về trang chủ</span>
            </Link>
          </AdminSidebarSection>
        </nav>
      </aside>

      <div className="admin-main">
        <button
          type="button"
          className="admin-drawer-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Mở menu"
        >
          <i className="fas fa-bars" />
          <span>Menu</span>
        </button>
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="stats" element={<AdminStats />} />
          <Route path="movies" element={<AdminMovies />} />
          <Route path="crawl" element={<AdminCrawl />} />
          <Route path="movies/add" element={<AdminAddMovie />} />
          <Route path="movies/edit/:id" element={<AdminEditMovie />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="genres" element={<AdminGenres />} />
          <Route path="countries" element={<AdminCountries />} />
          <Route path="directors" element={<AdminDirectors />} />
          <Route path="actors" element={<AdminActors />} />
          <Route path="release-years" element={<AdminReleaseYears />} />
          <Route path="realtime" element={<AdminRealtime />} />
          <Route path="episodes" element={<AdminEpisodes />} />
          <Route path="comments" element={<AdminComments />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="ads" element={<AdminAds />} />
          <Route path="logs" element={<AdminLogs />} />
        </Routes>
      </div>
    </div>
  );
}
