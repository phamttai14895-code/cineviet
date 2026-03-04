import { Link, useLocation } from 'react-router-dom';
import { useBreadcrumb } from '../context/BreadcrumbContext';

const PATH_LABELS = {
  '': 'Trang chủ',
  'phim-moi': 'Phim Mới',
  'phim-bo': 'Phim Bộ',
  'phim-le': 'Phim Lẻ',
  'anime': 'Anime',
  'tv-shows': 'TV Shows',
  'phim-chieu-rap': 'Phim Chiếu Rạp',
  'the-loai': 'Thể loại',
  'quoc-gia': 'Quốc gia',
  'dien-vien': 'Diễn viên',
  'nam': 'Năm',
  'goi-y': 'Tui pick, bạn chill 😌',
  'xem-chung': 'Xem Chung',
  'tim-kiem': 'Tìm kiếm',
  'movie': 'Phim',
  'watch': 'Xem phim',
  'profile': 'Tài khoản',
  'lien-he': 'Liên hệ',
  'dieu-khoan': 'Điều khoản',
  'bao-mat': 'Bảo mật',
  'dmca': 'DMCA',
  'sitemap': 'Sitemap',
  'register': 'Đăng ký',
};

function pathToBreadcrumb(pathname) {
  const segments = pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
  const items = [{ label: 'Trang chủ', to: '/' }];
  let acc = '';
  for (let i = 0; i < segments.length; i++) {
    acc += (acc ? '/' : '') + segments[i];
    const segment = segments[i];
    let label = PATH_LABELS[segment];
    if (label == null && segment && !/^\d+$/.test(segment)) {
      try { label = decodeURIComponent(segment); } catch { label = segment; }
    }
    if (label != null) {
      items.push({
        label: i === segments.length - 1 && /^\d+$/.test(segment) ? `#${segment}` : label,
        to: i === segments.length - 1 ? null : `/${acc}`,
      });
    }
  }
  return items;
}

export default function Breadcrumb() {
  const location = useLocation();
  const { items: contextItems } = useBreadcrumb();
  const items = contextItems?.length > 0 ? contextItems : pathToBreadcrumb(location.pathname);
  if (items.length <= 1) return null;

  return (
    <div className="breadcrumb-wrap">
      <div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <ol className="breadcrumb-list">
        {items.map((item, i) => (
          <li key={i} className="breadcrumb-item">
            {i > 0 && <span className="breadcrumb-sep" aria-hidden> / </span>}
            {item.to ? (
              <Link to={item.to} className="breadcrumb-link">{item.label}</Link>
            ) : (
              <span className="breadcrumb-current" aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
          </ol>
        </nav>
      </div>
    </div>
  );
}
