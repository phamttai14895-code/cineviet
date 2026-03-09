import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';
import LoginModal from './LoginModal';
import RegisterModal from './RegisterModal';
import { movies as moviesApi, admin as adminApi, user as userApi } from '../api/client';
import { imageDisplayUrl } from '../utils/imageUrl';
import { slugify } from '../utils/slugify.js';
import { toTitleCase } from '../utils/titleCase.js';
import CineVietLogo from './CineVietLogo';

export default function Header() {
  const { user, logout, loginModalOpen, setLoginModalOpen, openLoginModal, registerModalOpen, setRegisterModalOpen } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileModalState, setProfileModalState] = useState({ open: false, initialTab: null });

  const openProfileModal = (initialTab = null) => {
    setProfileModalState({ open: true, initialTab });
  };
  const closeProfileModal = () => {
    setProfileModalState({ open: false, initialTab: null });
  };
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [drawerGenreOpen, setDrawerGenreOpen] = useState(false);
  const [drawerCountryOpen, setDrawerCountryOpen] = useState(false);
  const mobileSearchInputRef = useRef(null);
  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [genrePanelStyle, setGenrePanelStyle] = useState({});
  const [countryPanelStyle, setCountryPanelStyle] = useState({});
  const dropdownRef = useRef(null);
  const genreTriggerRef = useRef(null);
  const countryTriggerRef = useRef(null);
  const genreDropdownRef = useRef(null);
  const countryDropdownRef = useRef(null);
  const drawerGenreToggleRef = useRef(null);
  const drawerCountryToggleRef = useRef(null);
  const [drawerGenrePanelStyle, setDrawerGenrePanelStyle] = useState({});
  const [drawerCountryPanelStyle, setDrawerCountryPanelStyle] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestList, setSuggestList] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestDebounceRef = useRef(null);
  const suggestBlurRef = useRef(null);
  const searchWrapRef = useRef(null);
  const mobileSearchWrapRef = useRef(null);

  const isAdmin = location.pathname.startsWith('/admin') && user?.role === 'admin';
  const [adminNotifOpen, setAdminNotifOpen] = useState(false);
  const [adminReportedCount, setAdminReportedCount] = useState(0);
  const [adminPendingReports, setAdminPendingReports] = useState(0);
  const adminNotifRef = useRef(null);

  useEffect(() => {
    if (!isAdmin) return;
    adminApi.commentsReportedCount().then((r) => setAdminReportedCount(r.data?.count ?? 0)).catch(() => {});
    adminApi.reportsCount().then((r) => setAdminPendingReports(r.data?.pending ?? 0)).catch(() => {});
  }, [isAdmin]);
  useEffect(() => {
    if (!isAdmin) return;
    const onR = () => adminApi.reportsCount().then((r) => setAdminPendingReports(r.data?.pending ?? 0)).catch(() => {});
    const onC = () => adminApi.commentsReportedCount().then((r) => setAdminReportedCount(r.data?.count ?? 0)).catch(() => {});
    window.addEventListener('admin-reports-updated', onR);
    window.addEventListener('admin-comments-updated', onC);
    return () => {
      window.removeEventListener('admin-reports-updated', onR);
      window.removeEventListener('admin-comments-updated', onC);
    };
  }, [isAdmin]);
  useEffect(() => {
    if (!adminNotifOpen) return;
    adminApi.commentsReportedCount().then((r) => setAdminReportedCount(r.data?.count ?? 0)).catch(() => {});
    adminApi.reportsCount().then((r) => setAdminPendingReports(r.data?.pending ?? 0)).catch(() => {});
    const onDocClick = (e) => {
      if (adminNotifRef.current && !adminNotifRef.current.contains(e.target)) setAdminNotifOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [adminNotifOpen]);

  const adminTotalNotif = adminReportedCount + adminPendingReports;

  const showUserNotifBell = user && !isAdmin;
  const [userNotifOpen, setUserNotifOpen] = useState(false);
  const [userNotifications, setUserNotifications] = useState([]);
  const [userNotifCount, setUserNotifCount] = useState(0);
  const userNotifRef = useRef(null);

  const fetchUserNotifications = () => {
    if (!showUserNotifBell) return;
    userApi.notifications(20).then((r) => {
      const list = r.data?.notifications || [];
      setUserNotifications(list);
      setUserNotifCount(r.data?.unreadCount ?? 0);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchUserNotifications();
  }, [showUserNotifBell]);

  useEffect(() => {
    if (!userNotifOpen || !showUserNotifBell) return;
    fetchUserNotifications();
    const onDocClick = (e) => {
      if (userNotifRef.current && !userNotifRef.current.contains(e.target)) setUserNotifOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [userNotifOpen, showUserNotifBell]);

  const handleMarkNotificationsRead = (e) => {
    e.preventDefault();
    userApi.markNotificationsRead().then(() => {
      setUserNotifCount(0);
      fetchUserNotifications();
    }).catch(() => {});
  };

  useEffect(() => {
    if (mobileSearchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [mobileSearchOpen]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSuggestList([]);
      return;
    }
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(() => {
      setSuggestLoading(true);
      moviesApi
        .suggest(q, 10)
        .then((r) => setSuggestList(r.data?.movies || []))
        .catch(() => setSuggestList([]))
        .finally(() => setSuggestLoading(false));
    }, 250);
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (suggestBlurRef.current) clearTimeout(suggestBlurRef.current);
    };
  }, []);

  useEffect(() => {
    moviesApi.genres().then((r) => setGenres(r.data || [])).catch(() => {});
    moviesApi.countries().then((r) => setCountries(r.data || [])).catch(() => {});
  }, []);

  const updatePanelPosition = (triggerRef, setStyle) => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: Math.max(rect.width, 180),
    });
  };

  useLayoutEffect(() => {
    if (genreDropdownOpen) updatePanelPosition(genreTriggerRef, setGenrePanelStyle);
  }, [genreDropdownOpen]);

  useLayoutEffect(() => {
    if (countryDropdownOpen) updatePanelPosition(countryTriggerRef, setCountryPanelStyle);
  }, [countryDropdownOpen]);

  const updateDrawerPanelPosition = (triggerRef, setStyle) => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 8;
    const pad = 12;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const panelMinW = 200;
    const panelMaxW = 280;
    const spaceRight = w - rect.right - gap;
    const spaceLeft = rect.left - gap;
    // Chỉ mobile/tablet (w < 768): panel full ngang, nằm ngay dưới nút (Thể loại dưới Thể loại, Quốc gia dưới Quốc gia). Desktop (≥768) giữ nguyên.
    if (w < 768) {
      const top = rect.bottom + gap;
      const maxH = h - top - 8;
      setStyle({
        position: 'fixed',
        top,
        left: 0,
        right: 0,
        width: '100vw',
        minWidth: '100vw',
        maxWidth: '100vw',
        maxHeight: Math.max(220, maxH),
        zIndex: 1003,
        boxSizing: 'border-box',
      });
      return;
    }
    const showOnRight = spaceRight >= panelMinW;
    const maxW = showOnRight
      ? Math.min(panelMaxW, spaceRight - pad)
      : Math.min(panelMaxW, spaceLeft - pad);
    const maxH = h - rect.top - pad;
    setStyle({
      position: 'fixed',
      top: rect.top,
      left: showOnRight ? rect.right + gap : undefined,
      right: showOnRight ? undefined : w - rect.left + gap,
      minWidth: Math.min(panelMinW, maxW),
      maxWidth: maxW,
      maxHeight: Math.max(220, maxH),
      zIndex: 1003,
    });
  };

  useLayoutEffect(() => {
    if (!drawerGenreOpen || !mobileMenuOpen) return;
    const run = () => updateDrawerPanelPosition(drawerGenreToggleRef, setDrawerGenrePanelStyle);
    run();
    const t = requestAnimationFrame(run);
    return () => cancelAnimationFrame(t);
  }, [drawerGenreOpen, mobileMenuOpen]);

  useLayoutEffect(() => {
    if (!drawerCountryOpen || !mobileMenuOpen) return;
    const run = () => updateDrawerPanelPosition(drawerCountryToggleRef, setDrawerCountryPanelStyle);
    run();
    const t = requestAnimationFrame(run);
    return () => cancelAnimationFrame(t);
  }, [drawerCountryOpen, mobileMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(e.target)) setGenreDropdownOpen(false);
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target)) setCountryDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = (searchQuery || (e.target.q && e.target.q.value) || '').trim();
    if (q) navigate(`/tim-kiem?q=${encodeURIComponent(q)}`);
    else navigate('/tim-kiem');
    setSuggestOpen(false);
  };

  const closeSuggest = () => {
    if (suggestBlurRef.current) clearTimeout(suggestBlurRef.current);
    suggestBlurRef.current = setTimeout(() => setSuggestOpen(false), 200);
  };

  const keepSuggestOpen = () => {
    if (suggestBlurRef.current) clearTimeout(suggestBlurRef.current);
  };

  return (
    <header className="header">
      <div className={`container header-inner${mobileSearchOpen ? ' header-search-expanded' : ''}`}>
        <button
          type="button"
          className={`header-mobile-menu-btn ${mobileMenuOpen ? 'is-open' : ''}`}
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={mobileMenuOpen}
        >
          <i className={mobileMenuOpen ? 'fas fa-times' : 'fas fa-bars'} aria-hidden />
        </button>
        <div className="header-mobile-center">
          {!mobileSearchOpen && (
            <Link to="/" className="header-mobile-center-link logo" onClick={() => setMobileMenuOpen(false)} aria-label="Về trang chủ">
              <CineVietLogo variant="header" />
            </Link>
          )}
          {mobileSearchOpen && (
            <div className="header-mobile-search-row">
              <div ref={mobileSearchWrapRef} className="header-mobile-search-wrap">
                <form
                onSubmit={(e) => {
                  handleSearch(e);
                  setMobileSearchOpen(false);
                }}
                className="header-mobile-search-inline"
              >
                <input
                  ref={mobileSearchInputRef}
                  name="q"
                  type="search"
                  placeholder="Tìm phim, diễn viên..."
                  className="header-mobile-search-inline-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSuggestOpen(true)}
                  onBlur={closeSuggest}
                  autoComplete="off"
                />
              </form>
              {suggestOpen && (searchQuery.trim() || suggestList.length > 0 || suggestLoading) && (
                <div className="header-search-suggest header-search-suggest-mobile" onMouseDown={keepSuggestOpen}>
                  {suggestLoading ? (
                    <div className="header-search-suggest-loading">Đang tìm...</div>
                  ) : suggestList.length === 0 && searchQuery.trim() ? (
                    <div className="header-search-suggest-empty">Không có gợi ý</div>
                  ) : (
                    <ul className="header-search-suggest-list">
                      {suggestList.map((m) => (
                        <li key={m.id}>
                          <Link to={`/movie/${m.slug || m.id}`} className="header-search-suggest-item" onClick={() => { setSuggestOpen(false); setMobileSearchOpen(false); }}>
                            {m.thumbnail || m.poster ? (
                              <img src={imageDisplayUrl(m.thumbnail || m.poster)} alt="" className="header-search-suggest-thumb" />
                            ) : (
                              <span className="header-search-suggest-thumb header-search-suggest-thumb-placeholder" />
                            )}
                            <span className="header-search-suggest-text">
                              <span className="header-search-suggest-title">{toTitleCase(m.title)}</span>
                              {m.title_en && <span className="header-search-suggest-title-en">{toTitleCase(m.title_en)}</span>}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              </div>
              <button
                type="button"
                className="header-mobile-search-btn header-mobile-search-close-btn"
                onClick={() => setMobileSearchOpen(false)}
                aria-label="Đóng tìm kiếm"
              >
                <i className="fas fa-times" />
              </button>
            </div>
          )}
        </div>
        <nav className="nav nav-menu header-nav-desktop">
          <NavLink to="/phim-moi" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Phim Mới</NavLink>
          <NavLink to="/phim-bo" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Phim Bộ</NavLink>
          <NavLink to="/phim-le" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Phim Lẻ</NavLink>

          <div className="nav-dropdown" ref={genreDropdownRef}>
            <button
              ref={genreTriggerRef}
              type="button"
              className="nav-link nav-dropdown-trigger"
              onClick={(e) => { e.stopPropagation(); setGenreDropdownOpen((v) => !v); setCountryDropdownOpen(false); }}
              aria-expanded={genreDropdownOpen}
              aria-haspopup="true"
            >
              Thể Loại
              <i className={`fas fa-chevron-down nav-dropdown-chevron ${genreDropdownOpen ? 'open' : ''}`} />
            </button>
            {genreDropdownOpen && (
              <div className="nav-dropdown-panel nav-dropdown-panel-fixed nav-dropdown-panel-genres" style={genrePanelStyle}>
                <Link to="/" className="nav-dropdown-item" onClick={() => setGenreDropdownOpen(false)}>Tất cả</Link>
                {genres.slice(0, 12).map((g) => (
                  <Link key={g.id} to={`/the-loai/${g.id}`} className="nav-dropdown-item" onClick={() => setGenreDropdownOpen(false)}>{g.name}</Link>
                ))}
                <Link to="/the-loai" className="nav-dropdown-item nav-dropdown-item-more" onClick={() => setGenreDropdownOpen(false)}>Xem tất cả thể loại →</Link>
              </div>
            )}
          </div>

          <div className="nav-dropdown" ref={countryDropdownRef}>
            <button
              ref={countryTriggerRef}
              type="button"
              className="nav-link nav-dropdown-trigger"
              onClick={(e) => { e.stopPropagation(); setCountryDropdownOpen((v) => !v); setGenreDropdownOpen(false); }}
              aria-expanded={countryDropdownOpen}
              aria-haspopup="true"
            >
              Quốc Gia
              <i className={`fas fa-chevron-down nav-dropdown-chevron ${countryDropdownOpen ? 'open' : ''}`} />
            </button>
            {countryDropdownOpen && (
              <div className="nav-dropdown-panel nav-dropdown-panel-fixed nav-dropdown-panel-countries" style={countryPanelStyle}>
                <Link to="/" className="nav-dropdown-item" onClick={() => setCountryDropdownOpen(false)}>Tất cả</Link>
                {countries.map((c) => {
                  const name = typeof c === 'object' ? c.name : c;
                  const slug = (typeof c === 'object' && c.slug) ? c.slug : slugify(name);
                  return (
                    <Link key={c.id || c} to={`/quoc-gia/${slug}`} className="nav-dropdown-item" onClick={() => setCountryDropdownOpen(false)}>{name}</Link>
                  );
                })}
                <Link to="/quoc-gia" className="nav-dropdown-item nav-dropdown-item-more" onClick={() => setCountryDropdownOpen(false)}>Xem tất cả quốc gia →</Link>
              </div>
            )}
          </div>

          {/* <NavLink to="/nam" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Năm</NavLink> */}
          <NavLink to="/goi-y" className={({ isActive }) => `nav-link nav-link-pick ${isActive ? 'active' : ''}`}>Tui pick, bạn chill 😌</NavLink>
          <NavLink to="/xem-chung" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Xem Chung</NavLink>
          <NavLink to="/dien-vien" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Diễn Viên</NavLink>
        </nav>
        <div className="header-right">
          <div ref={searchWrapRef} className="header-search-wrap">
            <form onSubmit={handleSearch} className="header-search header-search-desktop">
              <input
                name="q"
                type="search"
                placeholder="Tìm phim, diễn viên..."
                className="header-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSuggestOpen(true)}
                onBlur={closeSuggest}
                autoComplete="off"
              />
              <button type="submit" className="header-search-btn" aria-label="Tìm kiếm">
                <i className="fas fa-search" />
              </button>
            </form>
            {suggestOpen && (searchQuery.trim() || suggestList.length > 0 || suggestLoading) && (
              <div className="header-search-suggest" onMouseDown={keepSuggestOpen}>
                {suggestLoading ? (
                  <div className="header-search-suggest-loading">Đang tìm...</div>
                ) : suggestList.length === 0 && searchQuery.trim() ? (
                  <div className="header-search-suggest-empty">Không có gợi ý</div>
                ) : (
                  <ul className="header-search-suggest-list">
                    {suggestList.map((m) => (
                      <li key={m.id}>
                        <Link to={`/movie/${m.slug || m.id}`} className="header-search-suggest-item" onClick={() => setSuggestOpen(false)}>
                          {m.thumbnail || m.poster ? (
                            <img src={imageDisplayUrl(m.thumbnail || m.poster)} alt="" className="header-search-suggest-thumb" />
                          ) : (
                            <span className="header-search-suggest-thumb header-search-suggest-thumb-placeholder" />
                          )}
                          <span className="header-search-suggest-text">
                            <span className="header-search-suggest-title">{toTitleCase(m.title)}</span>
                            {m.title_en && <span className="header-search-suggest-title-en">{toTitleCase(m.title_en)}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          {!mobileSearchOpen && (
            <button
              type="button"
              className="header-mobile-search-btn"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Tìm kiếm"
            >
              <i className="fas fa-search" />
            </button>
          )}
          {isAdmin && (
            <div className="header-admin-notif-wrap" ref={adminNotifRef}>
              <button
                type="button"
                className="header-admin-notif-bell"
                onClick={(e) => { e.stopPropagation(); setAdminNotifOpen((v) => !v); }}
                aria-label={'Thông báo'}
                aria-expanded={adminNotifOpen}
              >
                <i className="fas fa-bell" />
                {adminTotalNotif > 0 && (
                  <span className="header-admin-notif-badge">{adminTotalNotif > 99 ? '99+' : adminTotalNotif}</span>
                )}
              </button>
              {adminNotifOpen && (
                <div className="header-admin-notif-dropdown">
                  <div className="header-admin-notif-dropdown-title">{'Thông báo'}</div>
                  {adminReportedCount > 0 && (
                    <Link
                      to="/admin/comments?filter=reported"
                      className="header-admin-notif-item"
                      onClick={() => setAdminNotifOpen(false)}
                    >
                      <i className="fas fa-comment-dots header-admin-notif-icon comments" />
                      <span>{'Bình luận bị báo cáo'}</span>
                      <span className="header-admin-notif-item-count">{adminReportedCount}</span>
                    </Link>
                  )}
                  {adminPendingReports > 0 && (
                    <Link
                      to="/admin/reports"
                      className="header-admin-notif-item"
                      onClick={() => setAdminNotifOpen(false)}
                    >
                      <i className="fas fa-triangle-exclamation header-admin-notif-icon reports" />
                      <span>{'Báo cáo lỗi phim'}</span>
                      <span className="header-admin-notif-item-count">{adminPendingReports}</span>
                    </Link>
                  )}
                  {adminTotalNotif === 0 && (
                    <div className="header-admin-notif-empty">{'Không có thông báo mới'}</div>
                  )}
                </div>
              )}
            </div>
          )}
          {showUserNotifBell && (
            <div className="header-user-notif-wrap" ref={userNotifRef}>
              <button
                type="button"
                className="header-user-notif-bell"
                onClick={(e) => { e.stopPropagation(); setUserNotifOpen((v) => !v); }}
                aria-label={'Thông báo'}
                aria-expanded={userNotifOpen}
              >
                <i className="fas fa-bell" />
                {userNotifCount > 0 && (
                  <span className="header-user-notif-badge">{userNotifCount > 99 ? '99+' : userNotifCount}</span>
                )}
              </button>
              {userNotifOpen && (
                <div className="header-user-notif-dropdown">
                  <div className="header-user-notif-dropdown-head">
                    <span className="header-user-notif-dropdown-title">{'Thông báo'}</span>
                    <button
                      type="button"
                      className="header-user-notif-mark-read"
                      onClick={handleMarkNotificationsRead}
                    >
                      {'Đánh dấu đã đọc'}
                    </button>
                  </div>
                  {userNotifications.length === 0 ? (
                    <div className="header-user-notif-empty">{'Không có thông báo mới. Bật "Phim mới cập nhật" hoặc "Tập mới phim bộ" trong Thông tin cá nhân để nhận thông báo.'}</div>
                  ) : (
                    <div className="header-user-notif-list">
                      {userNotifications.map((n, i) => (
                        <Link
                          key={n.type === 'tap_moi' && n.id ? `tap-${n.id}` : `phim-${i}`}
                          to={n.link || '#'}
                          className="header-user-notif-card"
                          onClick={() => setUserNotifOpen(false)}
                        >
                          <span className={`header-user-notif-card-icon ${n.type}`}>
                            {n.type === 'tap_moi' ? <i className="fas fa-film" /> : <i className="fas fa-fire" />}
                          </span>
                          <div className="header-user-notif-card-body">
                            <span className="header-user-notif-card-title">{n.title}</span>
                            <span className="header-user-notif-card-desc">{n.description}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {user ? (
            <div className="user-menu-dropdown" ref={dropdownRef}>
              <button
                type="button"
                className="user-menu-trigger"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen((v) => !v); }}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="user-menu-avatar" />
                ) : (
                  <span className="user-menu-avatar-placeholder">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
                <span className="user-menu-name">{user.name}</span>
                <i className={`fas fa-chevron-down user-menu-chevron ${dropdownOpen ? 'open' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="user-menu-dropdown-panel">
                  <button type="button" className="user-menu-item" onClick={() => { setDropdownOpen(false); openProfileModal(); }}>
                    {'Thông tin cá nhân'}
                  </button>
                  <Link to="/profile" className="user-menu-item" onClick={() => setDropdownOpen(false)}>
                    {'Yêu thích / Đã xem'}
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" className="user-menu-item" onClick={() => setDropdownOpen(false)}>
                      {'Admin'}
                    </Link>
                  )}
                  <button type="button" className="user-menu-item user-menu-item-logout" onClick={handleLogout}>
                    {'Đăng xuất'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="header-member-btn"
              onClick={() => setLoginModalOpen(true)}
            >
              <i className="fas fa-user" />
              <span>Thành Viên</span>
            </button>
          )}
        </div>
      </div>

      {/* Drawer menu mobile — logo web (CINEVIET), menu 2 cột như header, không Tải ứng dụng */}
      <div className={`header-mobile-drawer-backdrop ${mobileMenuOpen ? 'open' : ''}`} aria-hidden onClick={() => setMobileMenuOpen(false)} />
      <div className={`header-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`} role="dialog" aria-label="Menu điều hướng">
        <div className="header-mobile-drawer-inner">
          <div className="header-mobile-drawer-header">
            <Link to="/" className="header-mobile-drawer-logo" onClick={() => setMobileMenuOpen(false)}>
              <CineVietLogo variant="drawer" />
            </Link>
            <button type="button" className="header-mobile-drawer-close" onClick={() => setMobileMenuOpen(false)} aria-label={'Đóng menu'}>
              <i className="fas fa-times" />
            </button>
          </div>
          {!user ? (
            <button
              type="button"
              className="header-mobile-drawer-member"
              onClick={() => { setMobileMenuOpen(false); setLoginModalOpen(true); }}
            >
              <i className="fas fa-user" />
              <span>Thành Viên</span>
            </button>
          ) : (
            <Link to="/profile" className="header-mobile-drawer-member" onClick={() => setMobileMenuOpen(false)}>
              <i className="fas fa-user" />
              <span>{user.name || 'Tài khoản'}</span>
            </Link>
          )}
          <div className="header-mobile-drawer-pick-wrap">
            <NavLink to="/goi-y" className={({ isActive }) => `header-mobile-drawer-pick-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              Tui pick, bạn chill 😌
            </NavLink>
          </div>
          <nav className="header-mobile-drawer-nav">
            <NavLink to="/phim-moi" className={({ isActive }) => `header-mobile-drawer-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>{'Phim Mới'}</NavLink>
            <div className="header-mobile-drawer-dropdown">
              <button
                ref={drawerGenreToggleRef}
                type="button"
                className={`header-mobile-drawer-dropdown-toggle ${drawerGenreOpen ? 'open' : ''}`}
                onClick={() => { setDrawerCountryOpen(false); setDrawerGenreOpen((v) => !v); }}
                aria-expanded={drawerGenreOpen}
              >
                <span>Thể Loại</span>
                <span className="header-mobile-drawer-dropdown-arrow" aria-hidden>{drawerGenreOpen ? '▲' : '▼'}</span>
              </button>
              {drawerGenreOpen &&
                createPortal(
                  <div className="header-mobile-drawer-dropdown-panel header-mobile-drawer-dropdown-panel--grid header-mobile-drawer-dropdown-panel--floating" style={drawerGenrePanelStyle}>
                    <Link to="/the-loai" className="header-mobile-drawer-dropdown-link" onClick={() => setMobileMenuOpen(false)}>{'Xem tất cả thể loại →'}</Link>
                    {genres.slice(0, 12).map((g) => (
                      <Link key={g.id} to={`/the-loai/${g.id}`} className="header-mobile-drawer-dropdown-link" onClick={() => setMobileMenuOpen(false)}>{g.name}</Link>
                    ))}
                  </div>,
                  document.body
                )}
            </div>
            <NavLink to="/phim-bo" className={({ isActive }) => `header-mobile-drawer-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>{'Phim Bộ'}</NavLink>
            <div className="header-mobile-drawer-dropdown">
              <button
                ref={drawerCountryToggleRef}
                type="button"
                className={`header-mobile-drawer-dropdown-toggle ${drawerCountryOpen ? 'open' : ''}`}
                onClick={() => { setDrawerGenreOpen(false); setDrawerCountryOpen((v) => !v); }}
                aria-expanded={drawerCountryOpen}
              >
                <span>Quốc Gia</span>
                <span className="header-mobile-drawer-dropdown-arrow" aria-hidden>{drawerCountryOpen ? '▲' : '▼'}</span>
              </button>
              {drawerCountryOpen &&
                createPortal(
                  <div className="header-mobile-drawer-dropdown-panel header-mobile-drawer-dropdown-panel--floating" style={drawerCountryPanelStyle}>
                    <Link to="/quoc-gia" className="header-mobile-drawer-dropdown-link" onClick={() => setMobileMenuOpen(false)}>{'Xem tất cả quốc gia →'}</Link>
                    {countries.map((c) => {
                      const name = typeof c === 'object' ? c.name : c;
                      const id = typeof c === 'object' ? c.id : c;
                      const slug = (typeof c === 'object' && c.slug) ? c.slug : slugify(name);
                      return (
                        <Link key={id} to={`/quoc-gia/${slug}`} className="header-mobile-drawer-dropdown-link" onClick={() => setMobileMenuOpen(false)}>{name}</Link>
                      );
                    })}
                  </div>,
                  document.body
                )}
            </div>
            <NavLink to="/phim-le" className={({ isActive }) => `header-mobile-drawer-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>{'Phim Lẻ'}</NavLink>
            <NavLink to="/xem-chung" className={({ isActive }) => `header-mobile-drawer-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>{'Xem Chung'}</NavLink>
            <NavLink to="/dien-vien" className={({ isActive }) => `header-mobile-drawer-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>{'Diễn Viên'}</NavLink>
          </nav>
          {user && (
            <div className="header-mobile-drawer-footer">
              <button type="button" className="header-mobile-drawer-link" onClick={() => { setMobileMenuOpen(false); openProfileModal(); }}>
                {'Thông tin cá nhân'}
              </button>
              <Link to="/profile" className="header-mobile-drawer-link" onClick={() => setMobileMenuOpen(false)}>{'Yêu thích / Đã xem'}</Link>
              {user.role === 'admin' && (
                <Link to="/admin" className="header-mobile-drawer-link" onClick={() => setMobileMenuOpen(false)}>{'Admin'}</Link>
              )}
              <button type="button" className="header-mobile-drawer-link header-mobile-drawer-logout" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
                {'Đăng xuất'}
              </button>
            </div>
          )}
        </div>
      </div>

      <ProfileModal open={profileModalState.open} onClose={closeProfileModal} initialTab={profileModalState.initialTab} />
      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={() => setLoginModalOpen(false)}
      />
      <RegisterModal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        onSuccess={() => setRegisterModalOpen(false)}
      />
    </header>
  );
}
