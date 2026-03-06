import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { movies as moviesApi } from '../api/client';
import HomeMovieCard from '../components/HomeMovieCard';
import FeaturedCarousel from '../components/FeaturedCarousel';
import ContinueWatchingSection from '../components/ContinueWatchingSection';
import { useAdSettings, AdBanner } from '../components/AdZones';
import { getApiBase, usePublicSettings } from '../context/PublicSettingsContext';
import HomeTrendingBlock from '../components/HomeTrendingBlock';
import Top10Carousel from '../components/Top10Carousel';
import NewMoviesCarousel from '../components/NewMoviesCarousel';

const SECTION_SIZE = 6;

function getSectionLimit() {
  return SECTION_SIZE;
}

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [newMovies, setNewMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [movies, setMovies] = useState([]);
  const [anime, setAnime] = useState([]);
  const [tvShows, setTvShows] = useState([]);
  const [chieuRap, setChieuRap] = useState([]);
  const [top10Movies, setTop10Movies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionLimit, setSectionLimit] = useState(getSectionLimit);
  const adSettings = useAdSettings();
  const publicSettings = usePublicSettings();
  const homeNotice = (publicSettings?.home_notice || '').trim();
  const apiBase = getApiBase();
  const belowFeaturedEnabled =
    adSettings &&
    (adSettings.ad_below_featured_enabled === true || adSettings.ad_below_featured_enabled === '1') &&
    !!(adSettings.ad_below_featured_file && String(adSettings.ad_below_featured_file).trim());

  useEffect(() => {
    const onResize = () => setSectionLimit(getSectionLimit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const results = await Promise.allSettled([
          moviesApi.list({ featured: 1, limit: 10 }),
          moviesApi.list({ sort: 'created_at', order: 'desc', limit: 15 }),
          moviesApi.list({ type: 'series', limit: 14 }),
          moviesApi.list({ type: 'movie', sort: 'created_at', order: 'desc', limit: 14 }),
          moviesApi.list({ type: 'anime', limit: 14 }),
          moviesApi.list({ type: 'tvshows', limit: 14 }),
          moviesApi.list({ chieu_rap: 1, sort: 'created_at', order: 'desc', limit: 14 }),
          moviesApi.list({ sort: 'view_count_day', order: 'desc', limit: 10 }),
        ]);
        const getMovies = (r) => (r.status === 'fulfilled' && r.value?.data?.movies) ? r.value.data.movies : [];
        setFeatured(getMovies(results[0]));
        setNewMovies(getMovies(results[1]));
        setSeries(getMovies(results[2]));
        setMovies(getMovies(results[3]));
        setAnime(getMovies(results[4]));
        setTvShows(getMovies(results[5]));
        setChieuRap(getMovies(results[6]));
        setTop10Movies(getMovies(results[7]));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const newMoviesDisplay = useMemo(
    () => (sectionLimit ? newMovies.slice(0, sectionLimit) : newMovies),
    [newMovies, sectionLimit]
  );
  const top10Display = useMemo(
    () => (sectionLimit ? top10Movies.slice(0, sectionLimit) : top10Movies),
    [top10Movies, sectionLimit]
  );

  if (loading) {
    return (
      <div className="container loading-wrap">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="home">
      {/* PHIM NỔI BẬT - Carousel */}
      <FeaturedCarousel items={featured} />

      {/* Thông báo trang chủ — ngay dưới phim nổi bật */}
      {homeNotice && (
        <div className="home-notice-bar" role="status">
          <i className="fas fa-info-circle home-notice-icon" aria-hidden />
          <span className="home-notice-text">{homeNotice}</span>
        </div>
      )}

      {/* Banner quảng cáo dưới phim nổi bật */}
      {belowFeaturedEnabled && (
        <AdBanner zoneId="below_featured" imageUrl={`${apiBase}/ads/zone/below_featured`} linkUrl={(adSettings?.ad_below_featured_link && String(adSettings.ad_below_featured_link).trim()) || ''} className="ad-zone ad-below-featured" />
      )}

      {/* TIẾP TỤC XEM — chỉ hiện khi đã đăng nhập và có lịch sử chưa xem xong */}
      <ContinueWatchingSection />

      {/* PHIM MỚI CẬP NHẬT — carousel */}
      <section className="section home-section-first home-section-with-grid">
        <div className="container">
          <div className="home-section-header">
            <h2 className="home-section-title">
              <span className="bar" aria-hidden />
              <span className="home-section-title-text">PHIM MỚI CẬP NHẬT</span>
            </h2>
          </div>
        </div>
        <div className="home-section-grid-wrap">
          <NewMoviesCarousel items={(newMovies || []).slice(0, 12)} showNewBadge />
        </div>
      </section>

      {/* PHIM CHIẾU RẠP */}
      <section className="section home-section-with-grid">
        <div className="container">
          <div className="home-section-header">
            <h2 className="home-section-title">
              <span className="bar" aria-hidden />
              <span className="home-section-title-text">PHIM CHIẾU RẠP</span>
            </h2>
            <Link to="/phim-chieu-rap" className="home-section-view-all">
              Xem tất cả <i className="fas fa-chevron-right" />
            </Link>
          </div>
        </div>
        <div className="home-section-grid-wrap">
          <div className="home-section-grid-7x2">
            {chieuRap.slice(0, SECTION_SIZE).map((m) => (
              <HomeMovieCard key={m.id} movie={m} />
            ))}
          </div>
        </div>
      </section>

      {/* PHIM BỘ ĐANG CHIẾU */}
      <section className="section home-section-with-grid">
        <div className="container">
          <div className="home-section-header">
            <h2 className="home-section-title">
              <span className="bar" aria-hidden />
              <span className="home-section-title-text">PHIM BỘ ĐANG CHIẾU</span>
            </h2>
            <Link to="/phim-bo" className="home-section-view-all">
              Xem tất cả <i className="fas fa-chevron-right" />
            </Link>
          </div>
        </div>
        <div className="home-section-grid-wrap">
          <div className="home-section-grid-7x2">
            {series.slice(0, SECTION_SIZE).map((m) => (
              <HomeMovieCard key={m.id} movie={m} />
            ))}
          </div>
        </div>
      </section>

      {/* PHIM LẺ MỚI */}
      <section className="section home-section-with-grid">
        <div className="container">
          <div className="home-section-header">
            <h2 className="home-section-title">
              <span className="bar" aria-hidden />
              <span className="home-section-title-text">PHIM LẺ MỚI</span>
            </h2>
            <Link to="/phim-le" className="home-section-view-all">
              Xem tất cả <i className="fas fa-chevron-right" />
            </Link>
          </div>
        </div>
        <div className="home-section-grid-wrap">
          <div className="home-section-grid-7x2">
            {movies.slice(0, SECTION_SIZE).map((m) => (
              <HomeMovieCard key={m.id} movie={m} />
            ))}
          </div>
        </div>
      </section>

      {/* ANIME */}
      <section className="section home-section-with-grid">
        <div className="container">
          <div className="home-section-header">
            <h2 className="home-section-title">
              <span className="bar" aria-hidden />
              <span className="home-section-title-text">ANIME</span>
            </h2>
            <Link to="/anime" className="home-section-view-all">
              Xem tất cả <i className="fas fa-chevron-right" />
            </Link>
          </div>
        </div>
        <div className="home-section-grid-wrap">
          <div className="home-section-grid-7x2">
            {anime.slice(0, SECTION_SIZE).map((m) => (
              <HomeMovieCard key={m.id} movie={m} />
            ))}
          </div>
        </div>
      </section>

      {/* TV SHOWS */}
      <section className="section home-section-with-grid">
        <div className="container">
          <div className="home-section-header">
            <h2 className="home-section-title">
              <span className="bar" aria-hidden />
              <span className="home-section-title-text">TV SHOWS</span>
            </h2>
            <Link to="/tv-shows" className="home-section-view-all">
              Xem tất cả <i className="fas fa-chevron-right" />
            </Link>
          </div>
        </div>
        <div className="home-section-grid-wrap">
          <div className="home-section-grid-7x2">
            {tvShows.slice(0, SECTION_SIZE).map((m) => (
              <HomeMovieCard key={m.id} movie={m} />
            ))}
          </div>
        </div>
      </section>

      {/* TOP BÌNH LUẬN + Sôi nổi nhất / Yêu thích nhất / Bình luận mới */}
      <HomeTrendingBlock />

      {/* Top 10 phim xem nhiều nhất — carousel */}
      <Top10Carousel movies={top10Display} title="Top 10 Phim Xem Trong Ngày" />
    </div>
  );
}
