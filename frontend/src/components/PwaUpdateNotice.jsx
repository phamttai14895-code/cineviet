import { useState, useEffect } from 'react';

/**
 * Đăng ký SW (production) và hiện banner "Đã có phiên bản mới, tải lại?" khi có SW đang chờ.
 * User bấm "Tải lại" → gửi SKIP_WAITING → controllerchange → reload trang.
 */
export default function PwaUpdateNotice() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowBanner(true);
        }
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(registration.waiting);
              setShowBanner(true);
            }
          });
        });
      }).catch(() => {});
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }, []);

  useEffect(() => {
    if (!waitingWorker || !showBanner) return;
    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, [waitingWorker, showBanner]);

  const handleReload = () => {
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!showBanner) return null;

  return (
    <div className="pwa-update-banner" role="alert">
      <span className="pwa-update-banner-text">Đã có phiên bản mới. Tải lại để cập nhật.</span>
      <div className="pwa-update-banner-actions">
        <button type="button" className="pwa-update-banner-btn" onClick={handleReload}>
          Tải lại
        </button>
        <button type="button" className="pwa-update-banner-dismiss" onClick={() => setShowBanner(false)} aria-label="Đóng">
          Để sau
        </button>
      </div>
    </div>
  );
}
