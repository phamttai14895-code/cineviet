import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page-404">
      <div className="container">
        <div className="page-404-inner">
          <h1 className="page-404-title">404</h1>
          <p className="page-404-text">Trang bạn tìm không tồn tại hoặc đã bị xóa.</p>
          <div className="page-404-actions">
            <Link to="/" className="page-404-btn page-404-btn-primary">
              <i className="fas fa-home" /> Về trang chủ
            </Link>
            <Link to="/tim-kiem" className="page-404-btn page-404-btn-secondary">
              <i className="fas fa-search" /> Tìm phim
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
