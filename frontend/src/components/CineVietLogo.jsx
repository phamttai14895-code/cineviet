/**
 * Logo website: icon play + text. Tên hiển thị lấy từ Cài đặt hệ thống (site_name).
 * Variant: header (icon + text), loading (lớn, giữa màn hình), drawer | footer | modal (chỉ chữ).
 */
import { usePublicSettings } from '../context/PublicSettingsContext';

export default function CineVietLogo({ variant = 'header', as: Tag = 'span', href, className = '', ...props }) {
  const settings = usePublicSettings();
  const siteName = (settings?.site_name || '').trim() || 'CineViet';
  const showIcon = variant === 'header' || variant === 'loading' || variant === 'footer';
  const isLink = Tag === 'a' || href;
  const Wrapper = isLink ? 'a' : Tag;
  const wrapperProps = isLink ? { href: href || '/', ...props } : props;

  return (
    <Wrapper
      className={`cineviet-logo cineviet-logo--${variant} ${className}`.trim()}
      aria-label={isLink ? `${siteName} - Trang chủ` : undefined}
      {...wrapperProps}
    >
      {showIcon && (
        <span className="cineviet-logo-icon" aria-hidden>
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="cineviet-logo-icon-svg" aria-hidden>
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" fill="none" className="cineviet-logo-circle" />
            <path d="M20 16v16l14-8-14-8z" fill="currentColor" className="cineviet-logo-play" />
          </svg>
        </span>
      )}
      <span className="cineviet-logo-text">{siteName}</span>
    </Wrapper>
  );
}
