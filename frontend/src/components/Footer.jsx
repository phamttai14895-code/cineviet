import { Link } from 'react-router-dom';
import { useAdSettings, AdBanner } from './AdZones';
import { getApiBase, usePublicSettings } from '../context/PublicSettingsContext';
import CineVietLogo from './CineVietLogo';

export default function Footer({ isAdmin = false }) {
  const currentYear = new Date().getFullYear();
  const adSettings = useAdSettings();
  const apiBase = getApiBase();
  const publicSettings = usePublicSettings() || {};
  const off = (v) => v === false || v === '0';
  const hasFile = (v) => !!(v && String(v).trim());
  const footerBannerEnabled =
    !isAdmin &&
    (adSettings == null ||
      (!off(adSettings.ad_footer_banner_enabled) && (hasFile(adSettings.ad_footer_banner_file) || adSettings.ad_footer_banner_file == null)));

  const normalizeWebUrl = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return `https://${s}`;
  };

  const normalizeTelegramUrl = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (s.startsWith('@')) return `https://t.me/${s.slice(1)}`;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return `https://${s}`;
  };

  const normalizeEmailUrl = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (s.startsWith('mailto:')) return s;
    if (s.includes('@') && !s.startsWith('http://') && !s.startsWith('https://')) return `mailto:${s}`;
    return s;
  };

  const facebookHref = normalizeWebUrl(publicSettings.social_facebook);
  const telegramHref = normalizeTelegramUrl(publicSettings.social_telegram);
  const emailHref = normalizeEmailUrl(publicSettings.social_email);

  return (
    <footer className="site-footer" role="contentinfo">
      {(footerBannerEnabled !== false) && (
        <AdBanner zoneId="footer_banner" imageUrl={`${apiBase}/ads/zone/footer_banner`} linkUrl={(adSettings?.ad_footer_banner_link && String(adSettings.ad_footer_banner_link).trim()) || ''} className="ad-zone ad-footer-banner" />
      )}
      <div className="footer-gradient" aria-hidden />
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-vn-badge" aria-label="Hoàng Sa & Trường Sa là của Việt Nam!">
              <span className="footer-vn-badge-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="footer-vn-flag">
                  <circle cx="12" cy="12" r="10" fill="#DA251D" />
                  <path d="M12 5l1.8 5.5H19l-4.4 3.2 1.7 5.5L12 15.2l-4.3 3 1.7-5.5L5 10.5h5.2L12 5z" fill="#FFCD00" />
                </svg>
              </span>
              <span className="footer-vn-badge-text">Hoàng Sa & Trường Sa là của Việt Nam!</span>
            </div>
            <Link to="/" className="footer-logo">
              <CineVietLogo variant="footer" />
            </Link>
            <p className="footer-tagline">{publicSettings.site_description || 'Xem phim online chất lượng cao, cập nhật nhanh nhất. Miễn phí, không quảng cáo phiền.'}</p>
            <div className="footer-social" aria-label="Mạng xã hội">
              {facebookHref ? (
                <a href={facebookHref} className="footer-social-link" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-facebook-f" />
                </a>
              ) : (
                <span className="footer-social-link footer-social-link-disabled" aria-label="Facebook (chưa cấu hình)" aria-disabled="true">
                  <i className="fab fa-facebook-f" />
                </span>
              )}

              {telegramHref ? (
                <a href={telegramHref} className="footer-social-link" aria-label="Telegram" target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-telegram-plane" />
                </a>
              ) : (
                <span className="footer-social-link footer-social-link-disabled" aria-label="Telegram (chưa cấu hình)" aria-disabled="true">
                  <i className="fab fa-telegram-plane" />
                </span>
              )}

              {emailHref ? (
                <a href={emailHref} className="footer-social-link" aria-label="Email" target="_blank" rel="noopener noreferrer">
                  <i className="fas fa-envelope" />
                </a>
              ) : (
                <span className="footer-social-link footer-social-link-disabled" aria-label="Email (chưa cấu hình)" aria-disabled="true">
                  <i className="fas fa-envelope" />
                </span>
              )}
            </div>
          </div>

          <div className="footer-grid">
            <div className="footer-col">
              <h3 className="footer-col-title">Phim</h3>
              <ul className="footer-list">
                <li><Link to="/phim-moi">Phim Mới</Link></li>
                <li><Link to="/phim-bo">Phim Bộ</Link></li>
                <li><Link to="/phim-le">Phim Lẻ</Link></li>
                <li><Link to="/phim-chieu-rap">Phim Chiếu Rạp</Link></li>
                <li><Link to="/anime">Anime</Link></li>
                <li><Link to="/tv-shows">TV Shows</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h3 className="footer-col-title">Khám phá</h3>
              <ul className="footer-list">
                <li><Link to="/the-loai">Thể Loại</Link></li>
                <li><Link to="/quoc-gia">Quốc Gia</Link></li>
                <li><Link to="/dien-vien">Diễn Viên</Link></li>
                <li><Link to="/goi-y">Tui pick, bạn chill 😌</Link></li>
                <li><Link to="/">Trang chủ</Link></li>
                <li><Link to="/xem-chung">Xem Chung</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h3 className="footer-col-title">Hỗ trợ</h3>
              <ul className="footer-list">
                <li><Link to="/huong-dan-pwa">Hướng dẫn dùng app (PWA)</Link></li>
                <li><Link to="/lien-he">Liên hệ</Link></li>
                <li><Link to="/dieu-khoan">Điều khoản sử dụng</Link></li>
                <li><Link to="/bao-mat">Chính sách bảo mật</Link></li>
                <li><Link to="/dmca">DMCA</Link></li>
                <li><Link to="/sitemap">Sitemap</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} <strong>{publicSettings.site_name || 'CineViet'}</strong>. Nội dung chỉ phục vụ giải trí, không lưu trữ file phim.
          </p>
        </div>
      </div>
    </footer>
  );
}
