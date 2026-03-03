import { Link } from 'react-router-dom';

const SITE_URL = typeof window !== 'undefined' ? window.location.origin : '';
const API_BASE = typeof window !== 'undefined' ? (window.location.origin + '/api') : '';

const sections = [
  {
    title: 'Trang chủ & Chung',
    links: [
      { to: '/', label: 'Trang chủ' },
      { to: '/phim-chieu-rap', label: 'Phim Chiếu Rạp' },
    ],
  },
  {
    title: 'Phim',
    links: [
      { to: '/phim-moi', label: 'Phim Mới' },
      { to: '/phim-bo', label: 'Phim Bộ' },
      { to: '/phim-le', label: 'Phim Lẻ' },
      { to: '/anime', label: 'Anime' },
      { to: '/tv-shows', label: 'TV Shows' },
    ],
  },
  {
    title: 'Khám phá',
    links: [
      { to: '/the-loai', label: 'Thể loại' },
      { to: '/quoc-gia', label: 'Quốc gia' },
      { to: '/dien-vien', label: 'Diễn viên' },
      { to: '/goi-y', label: 'Gợi ý AI' },
      { to: '/xem-chung', label: 'Xem Chung' },
    ],
  },
  {
    title: 'Hỗ trợ & Pháp lý',
    links: [
      { to: '/lien-he', label: 'Liên hệ' },
      { to: '/dieu-khoan', label: 'Điều khoản sử dụng' },
      { to: '/bao-mat', label: 'Chính sách bảo mật' },
      { to: '/dmca', label: 'DMCA' },
    ],
  },
  {
    title: 'Tài khoản',
    links: [
      { to: '/profile', label: 'Tài khoản của tôi' },
    ],
  },
];

export default function Sitemap() {
  return (
    <div className="page-static page-sitemap">
      <div className="container">
        <header className="page-static-header">
          <h1 className="page-static-title">Sitemap</h1>
          <p className="page-static-subtitle">
            Danh sách các trang chính trên CineViet. Dùng để điều hướng nhanh hoặc tham chiếu cho công cụ tìm kiếm.
          </p>
          {API_BASE && (
            <p className="page-static-subtitle" style={{ marginTop: '0.5rem' }}>
              <a href={`${API_BASE}/sitemap.xml`} target="_blank" rel="noopener noreferrer">sitemap.xml</a> (cho crawler)
            </p>
          )}
        </header>

        <div className="sitemap-grid">
          {sections.map((section) => (
            <section key={section.title} className="sitemap-section">
              <h2 className="sitemap-section-title">{section.title}</h2>
              <ul className="sitemap-list">
                {section.links.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to}>{label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="page-static-back">
          <Link to="/"><i className="fas fa-arrow-left" /> Về trang chủ</Link>
        </p>
      </div>
    </div>
  );
}

export { SITE_URL };
