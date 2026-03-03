import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Analytics from './components/Analytics';
import MaintenanceGate from './components/MaintenanceGate';
import AppLoadingScreen from './components/AppLoadingScreen';
import PwaUpdateNotice from './components/PwaUpdateNotice';
import { useAuth } from './context/AuthContext';
import { useEffect } from 'react';

/* Lazy load trang để giảm bundle ban đầu, tải theo route */
const Home = lazy(() => import('./pages/Home'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const MovieDetail = lazy(() => import('./pages/MovieDetail'));
const Watch = lazy(() => import('./pages/Watch'));
const Actor = lazy(() => import('./pages/Actor'));
const Actors = lazy(() => import('./pages/Actors'));
const AiRecommend = lazy(() => import('./pages/AiRecommend'));
const TheLoai = lazy(() => import('./pages/TheLoai'));
const QuocGia = lazy(() => import('./pages/QuocGia'));
const NamPhatHanh = lazy(() => import('./pages/NamPhatHanh'));
const PhimChieuRap = lazy(() => import('./pages/PhimChieuRap'));
const MovieListPage = lazy(() => import('./pages/MovieListPage'));
const FilteredMovieListPage = lazy(() => import('./pages/FilteredMovieListPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const XemChung = lazy(() => import('./pages/XemChung'));
const XemChungRoom = lazy(() => import('./pages/XemChungRoom'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Dmca = lazy(() => import('./pages/Dmca'));
const Sitemap = lazy(() => import('./pages/Sitemap'));
const PwaGuide = lazy(() => import('./pages/PwaGuide'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Protected({ children, admin }) {
  const { user, loading, openLoginModal } = useAuth();
  useEffect(() => {
    if (!loading && !user && !admin) openLoginModal();
  }, [loading, user, openLoginModal, admin]);
  if (loading) return <AppLoadingScreen appName="CineViet" />;
  /* Chưa đăng nhập mà vào /admin → chuyển về trang chủ */
  if (!user && admin) return <Navigate to="/" replace state={{ adminDenied: true }} />;
  if (!user) return <div className="container loading-wrap">Vui lòng đăng nhập để tiếp tục.</div>;
  /* Đã đăng nhập nhưng không phải admin → chuyển về trang chủ */
  if (admin && (user.role !== 'admin')) {
    return <Navigate to="/" replace state={{ adminDenied: true }} />;
  }
  return children;
}

function PageFallback() {
  return <AppLoadingScreen appName="CineViet" />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Analytics />
      <PwaUpdateNotice />
      <MaintenanceGate>
      <Suspense fallback={<PageFallback />}>
      <Routes>
      <Route
        path="xem-chung/phong/:roomId"
        element={(
          <Protected>
            <XemChungRoom />
          </Protected>
        )}
      />
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="register" element={<Navigate to="/" replace />} />
        <Route path="auth/callback" element={<AuthCallback />} />
        <Route path="browse" element={<Navigate to="/" replace />} />
        <Route path="goi-y" element={<AiRecommend />} />
        <Route path="the-loai" element={<TheLoai />} />
        <Route path="the-loai/:id" element={<FilteredMovieListPage filterType="genre" paramKey="id" />} />
        <Route path="quoc-gia" element={<QuocGia />} />
        <Route path="quoc-gia/:country" element={<FilteredMovieListPage filterType="country" paramKey="country" />} />
        <Route path="nam" element={<NamPhatHanh />} />
        <Route path="nam/:year" element={<FilteredMovieListPage filterType="year" paramKey="year" />} />
        <Route path="phim-chieu-rap" element={<PhimChieuRap />} />
        <Route path="tim-kiem" element={<SearchPage />} />
        <Route path="phim-moi" element={<MovieListPage category="phim-moi" />} />
        <Route path="phim-bo" element={<MovieListPage category="phim-bo" />} />
        <Route path="phim-le" element={<MovieListPage category="phim-le" />} />
        <Route path="anime" element={<MovieListPage category="anime" />} />
        <Route path="tv-shows" element={<MovieListPage category="tv-shows" />} />
        <Route
          path="xem-chung"
          element={(
            <Protected>
              <XemChung />
            </Protected>
          )}
        />
        <Route path="movie/:idOrSlug" element={<MovieDetail />} />
        <Route path="watch/:id" element={<Watch />} />
        <Route path="dien-vien" element={<Actors />} />
        <Route path="dien-vien/:slug" element={<Actor />} />
        <Route path="lien-he" element={<Contact />} />
        <Route path="dieu-khoan" element={<Terms />} />
        <Route path="bao-mat" element={<Privacy />} />
        <Route path="dmca" element={<Dmca />} />
        <Route path="sitemap" element={<Sitemap />} />
        <Route path="huong-dan-pwa" element={<PwaGuide />} />
        <Route
          path="profile"
          element={
            <Protected>
              <Profile />
            </Protected>
          }
        />
        <Route
          path="admin/*"
          element={
            <Protected admin>
              <Admin />
            </Protected>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
      </Suspense>
      </MaintenanceGate>
    </>
  );
}
