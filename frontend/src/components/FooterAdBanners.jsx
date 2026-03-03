import { useState, useEffect, useCallback } from 'react';

const FOOTER_BANNER_ZONE = 'footer_banner';
const AD_HIDE_KEY = 'ad_hide_';

function getZoneHidden(zoneId) {
  try {
    return localStorage.getItem(AD_HIDE_KEY + zoneId) === '1';
  } catch {
    return false;
  }
}

function setZoneHidden(zoneId, hidden) {
  try {
    if (hidden) localStorage.setItem(AD_HIDE_KEY + zoneId, '1');
    else localStorage.removeItem(AD_HIDE_KEY + zoneId);
  } catch (_) {}
}

export default function FooterAdBanners() {
  const [hidden, setHidden] = useState(() => getZoneHidden(FOOTER_BANNER_ZONE));

  const handleHide = useCallback(() => {
    setZoneHidden(FOOTER_BANNER_ZONE, true);
    setHidden(true);
  }, []);

  const handleShow = useCallback(() => {
    setZoneHidden(FOOTER_BANNER_ZONE, false);
    setHidden(false);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === AD_HIDE_KEY + FOOTER_BANNER_ZONE) setHidden(getZoneHidden(FOOTER_BANNER_ZONE));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (hidden) {
    return (
      <div className="footer-ad-banners footer-ad-banners--collapsed">
        <button type="button" className="footer-ad-show-btn" onClick={handleShow} aria-label="Hiện quảng cáo">
          <i className="fas fa-chevron-up" /> Hiện quảng cáo
        </button>
      </div>
    );
  }

  return (
    <div className="footer-ad-banners">
      <button type="button" className="footer-ad-close-btn" onClick={handleHide} aria-label="Ẩn quảng cáo" title="Ẩn quảng cáo">
        <i className="fas fa-times" />
      </button>

      {/* Banner 1: Đảo Rồ Xanh - Discord */}
      <a href="#" className="footer-ad-banner footer-ad-banner--discord" onClick={(e) => e.preventDefault()} target="_blank" rel="noopener noreferrer">
        <div className="footer-ad-discord-icon">
          <span className="footer-ad-discord-icon-inner">
            <i className="fas fa-play" />
          </span>
        </div>
        <span className="footer-ad-discord-title">Đảo Rồ Xanh</span>
        <span className="footer-ad-discord-sub">- Nhóm Discord</span>
      </a>

      {/* Banner 2: APP ROPHIM Android */}
      <a href="#" className="footer-ad-banner footer-ad-banner--app" onClick={(e) => e.preventDefault()} target="_blank" rel="noopener noreferrer">
        <div className="footer-ad-app-text">APP ROPHIM DÀNH RIÊNG CHO ĐIỆN THOẠI VÀ TABLET ANDROID</div>
        <div className="footer-ad-app-visual">
          <div className="footer-ad-app-phone" aria-hidden>
            <i className="fas fa-mobile-alt" />
          </div>
          <span className="footer-ad-app-download">Download APP</span>
        </div>
      </a>
    </div>
  );
}
