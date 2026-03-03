import CineVietLogo from './CineVietLogo';

/**
 * Trang loading full màn hình: nền lưới poster mờ, logo CineViet có animation,
 * dòng "ĐANG TẢI TRẢI NGHIỆM ĐIỆN ẢNH" và animation 5 chấm.
 */
export default function AppLoadingScreen({ appName = 'CineViet' }) {
  return (
    <div className="app-loading-screen" role="status" aria-live="polite" aria-label="Đang tải">
      <div className="app-loading-bg">
        <div className="app-loading-grid" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="app-loading-grid-cell" style={{ '--cell-i': i }} />
          ))}
        </div>
      </div>
      <div className="app-loading-center">
        <h1 className="app-loading-title" aria-label={appName}>
          <CineVietLogo variant="loading" />
        </h1>
        <p className="app-loading-subtitle">ĐANG TẢI TRẢI NGHIỆM ĐIỆN ẢNH</p>
        <div className="app-loading-dots" aria-hidden="true">
          <span className="app-loading-dot" />
          <span className="app-loading-dot" />
          <span className="app-loading-dot" />
          <span className="app-loading-dot" />
          <span className="app-loading-dot" />
        </div>
      </div>
    </div>
  );
}
