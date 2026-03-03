import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import ThemeToggle from './ThemeToggle';
import BackToTopButton from './BackToTopButton';
import { WebSiteJsonLd } from './JsonLd';
import Breadcrumb from './Breadcrumb';
import AdZones from './AdZones';
import GoogleAnalytics4 from './GoogleAnalytics4';
import GoogleTagManager from './GoogleTagManager';
import ProtectionGuard from './ProtectionGuard';
import { PublicSettingsProvider } from '../context/PublicSettingsContext';
import { useToast } from '../context/ToastContext';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAdmin = location.pathname.startsWith('/admin');
  const isMovieDetail = /^\/movie\/[^/]+$/.test(location.pathname);

  useEffect(() => {
    if (location.state?.adminDenied) {
      toast.error('Bạn không có quyền truy cập trang quản trị.');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.adminDenied, location.pathname, navigate, toast]);

  return (
    <PublicSettingsProvider>
      <GoogleTagManager />
      <GoogleAnalytics4 />
      <ProtectionGuard />
      <div className="layout">
        <WebSiteJsonLd />
        <Header />
        {!isMovieDetail && <Breadcrumb />}
        <main className="layout-main">
          <Outlet />
        </main>
        {!isAdmin && <AdZones />}
        <Footer isAdmin={isAdmin} />
        <ThemeToggle />
        <BackToTopButton />
      </div>
    </PublicSettingsProvider>
  );
}
