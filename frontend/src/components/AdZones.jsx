import { useState, useEffect, useCallback } from 'react';
import { usePublicSettings, getApiBase } from '../context/PublicSettingsContext';

const POPUP_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 tiếng
const AD_HIDE_KEY = 'ad_hide_';

function getPopupShouldHide() {
  try {
    const raw = localStorage.getItem('ad_popup_closed_at');
    if (!raw) return false;
    const closedAt = parseInt(raw, 10);
    if (Number.isNaN(closedAt)) return false;
    return Date.now() - closedAt < POPUP_COOLDOWN_MS;
  } catch {
    return false;
  }
}

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

export default function AdZones() {
  const settings = usePublicSettings();
  const apiBase = getApiBase();

  const on = (v) => v === true || v === '1';
  const hasFile = (v) => !!(v && String(v).trim());
  const off = (v) => v === false || v === '0';
  const popupEnabled =
    settings == null ||
    (!off(settings.ad_popup_enabled) && (hasFile(settings.ad_popup_file) || settings.ad_popup_file == null));
  const sidebarLeftEnabled = settings && on(settings.ad_sidebar_left_enabled) && hasFile(settings.ad_sidebar_left_file);
  const sidebarRightEnabled = settings && on(settings.ad_sidebar_right_enabled) && hasFile(settings.ad_sidebar_right_file);

  const popupLink = (settings?.ad_popup_link && String(settings.ad_popup_link).trim()) || '';

  return (
    <>
      {(popupEnabled !== false) && (
        <AdPopup imageUrl={`${apiBase}/ads/zone/popup`} linkUrl={popupLink} />
      )}
      {sidebarLeftEnabled && (
        <AdBanner zoneId="sidebar_left" imageUrl={`${apiBase}/ads/zone/sidebar_left`} linkUrl={(settings?.ad_sidebar_left_link && String(settings.ad_sidebar_left_link).trim()) || ''} className="ad-zone ad-sidebar ad-sidebar-left" />
      )}
      {sidebarRightEnabled && (
        <AdBanner zoneId="sidebar_right" imageUrl={`${apiBase}/ads/zone/sidebar_right`} linkUrl={(settings?.ad_sidebar_right_link && String(settings.ad_sidebar_right_link).trim()) || ''} className="ad-zone ad-sidebar ad-sidebar-right" />
      )}
    </>
  );
}

function AdPopup({ imageUrl, linkUrl }) {
  const [closed, setClosed] = useState(getPopupShouldHide);
  const [imgFailed, setImgFailed] = useState(false);
  const href = (linkUrl && linkUrl.trim()) || '';

  useEffect(() => {
    if (closed) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem('ad_popup_closed_at', String(Date.now()));
      } catch (_) {}
    }, 5000);
    return () => clearTimeout(t);
  }, [closed]);

  const handleClose = () => {
    setClosed(true);
    try {
      localStorage.setItem('ad_popup_closed_at', String(Date.now()));
    } catch (_) {}
  };

  if (closed || imgFailed) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const linkProps = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href: '#', onClick: (e) => e.preventDefault() };

  return (
    <div className="ad-popup-overlay" role="dialog" aria-label="Quảng cáo" onClick={handleOverlayClick}>
      <div className="ad-popup-box" onClick={(e) => e.stopPropagation()}>
        <a className="ad-popup-link" {...linkProps}>
          <img src={imageUrl} alt="Quảng cáo" className="ad-popup-img" onError={() => setImgFailed(true)} />
        </a>
        <button type="button" className="ad-popup-close" onClick={handleClose} aria-label="Đóng" title="Ẩn (hiện lại sau 12 tiếng)">
          <i className="fas fa-times" />
        </button>
      </div>
    </div>
  );
}

export function AdBanner({ zoneId, imageUrl, linkUrl, className, onImageError }) {
  const [hidden, setHidden] = useState(() => (zoneId ? getZoneHidden(zoneId) : false));
  const [imgFailed, setImgFailed] = useState(false);
  const href = (linkUrl && String(linkUrl).trim()) || '';

  const handleHide = useCallback(() => {
    if (zoneId) setZoneHidden(zoneId, true);
    setHidden(true);
  }, [zoneId]);

  const handleShow = useCallback(() => {
    if (zoneId) setZoneHidden(zoneId, false);
    setHidden(false);
  }, [zoneId]);

  useEffect(() => {
    if (!zoneId) return;
    const onStorage = (e) => {
      if (e.key === AD_HIDE_KEY + zoneId) setHidden(getZoneHidden(zoneId));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [zoneId]);

  const handleError = () => {
    setImgFailed(true);
    onImageError?.();
  };

  if (hidden) {
    return (
      <div className={`${className} ad-zone-collapsed`}>
        <button type="button" className="ad-zone-show-btn" onClick={handleShow} aria-label="Hiện quảng cáo">
          <i className="fas fa-chevron-up" /> Hiện quảng cáo
        </button>
      </div>
    );
  }

  if (imgFailed) return null;

  const linkProps = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href: '#', onClick: (e) => e.preventDefault() };

  return (
    <div className={className}>
      <button type="button" className="ad-zone-hide-btn" onClick={handleHide} aria-label="Ẩn quảng cáo" title="Ẩn quảng cáo">
        <i className="fas fa-eye-slash" /> Ẩn
      </button>
      <a className="ad-banner-link" {...linkProps}>
        <img src={imageUrl} alt="Quảng cáo" className="ad-banner-img" onError={handleError} />
      </a>
    </div>
  );
}

export { usePublicSettings as useAdSettings } from '../context/PublicSettingsContext';
