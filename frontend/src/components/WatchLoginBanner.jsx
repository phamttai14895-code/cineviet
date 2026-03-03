import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/** URL ảnh/GIF mặc định: ưu tiên .gif (chạy được animation), không có thì dùng .png */
const DEFAULT_IMAGE = '/uploads/images/watch-login-sad.gif';
const FALLBACK_IMAGE = '/uploads/images/watch-login-sad.png';

/**
 * Banner trượt từ dưới lên khi vào trang xem phim mà chưa đăng nhập.
 * Kêu gọi đăng nhập / tạo tài khoản với nút pill đồng bộ design system.
 * Hỗ trợ ảnh GIF (chỉ cần đặt file .gif vào public/images/ hoặc truyền imageSrc).
 * Đóng khi: click bất kỳ đâu (trên banner hoặc ra ngoài) để đóng.
 */
export default function WatchLoginBanner({ onDismiss, imageSrc }) {
  const { openLoginModal, openRegisterModal } = useAuth();
  const [visible, setVisible] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(imageSrc || DEFAULT_IMAGE);

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (imageSrc) setCurrentSrc(imageSrc);
    else setCurrentSrc(DEFAULT_IMAGE);
  }, [imageSrc]);

  const handleDismiss = () => {
    if (typeof onDismiss === 'function') onDismiss();
  };

  const handleAction = (fn) => (e) => {
    e.stopPropagation();
    handleDismiss();
    if (typeof fn === 'function') fn();
  };

  return (
    <div
      className={`watch-login-banner ${visible ? 'watch-login-banner-visible' : ''}`}
      role="dialog"
      aria-label="Mời bạn đăng nhập để trải nghiệm đầy đủ"
      aria-describedby="watch-login-banner-desc"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); handleDismiss(); } }}
      title="Bấm để đóng"
    >
      <div
        className="watch-login-banner-backdrop"
        onClick={handleDismiss}
        aria-hidden="true"
      />
      <div className="watch-login-banner-inner" onClick={handleDismiss}>
        <div className="watch-login-banner-media">
          <img
            src={currentSrc}
            alt=""
            className="watch-login-banner-img"
            onError={(e) => {
              const img = e.target;
              if (currentSrc === FALLBACK_IMAGE || (imageSrc && currentSrc === imageSrc)) {
                img.style.display = 'none';
                const fallback = img.nextElementSibling;
                if (fallback) fallback.style.display = 'flex';
                return;
              }
              setCurrentSrc(FALLBACK_IMAGE);
            }}
          />
          <div className="watch-login-banner-img-fallback" aria-hidden="true">
            ♡ Huhu... Buồn Quá! ♡
          </div>
          <p className="watch-login-banner-caption">♡ Huhu... Buồn Quá! ♡</p>
        </div>

        <div className="watch-login-banner-content">
          <p id="watch-login-banner-desc" className="watch-login-banner-text">
            Bạn ơi, tụi mình thấy bạn đang lướt phim mà <strong className="watch-login-banner-highlight">chưa đăng nhập</strong>, buồn lắm luôn á 🥺
          </p>
          <p className="watch-login-banner-text">
            Tụi mình code ngày code đêm, mắt thâm quầng, tóc rụng từng nắm, chỉ để mấy bạn có phim hay mà xem. Vậy mà bạn không chịu <strong className="watch-login-banner-highlight">tạo tài khoản</strong> cho tụi mình 😤
          </p>
          <p className="watch-login-banner-text">
            Đăng nhập thôi mà, có mất gì đâu nè! Được lưu phim, được đánh giá, được bình luận, được nhớ tập đang xem dở... Toàn thứ hay ho hết á!
          </p>
          <p className="watch-login-banner-text">
            Tụi mình là nền tảng mới tinh, chưa có gì hết trơn á. Mấy bạn — những user đầu tiên — là tài sản quý giá nhất của tụi mình. Cho tụi mình xin một tài khoản đi mà 🙏
          </p>
          <p className="watch-login-banner-text watch-login-banner-text-small">
            Tụi mình quỳ xuống xin bạn luôn rồi nè... Đăng nhập đi, đừng để tụi mình khóc thêm nữa 😭
          </p>
        </div>

        <div className="watch-login-banner-actions">
          <button
            type="button"
            className="watch-login-banner-btn watch-login-banner-btn-primary"
            onClick={handleAction(openLoginModal)}
          >
            <span className="watch-login-banner-btn-icon" aria-hidden>→</span>
            Đăng Nhập Ngay!
          </button>
          <button
            type="button"
            className="watch-login-banner-btn watch-login-banner-btn-secondary"
            onClick={handleAction(openRegisterModal)}
          >
            <span className="watch-login-banner-btn-icon" aria-hidden>➕</span>
            Tạo Tài Khoản Mới
          </button>
          <button
            type="button"
            className="watch-login-banner-hint watch-login-banner-hint-btn"
            onClick={handleAction()}
          >
            (Để sau đi... cho mình về khóc tiếp) 😭
          </button>
        </div>
      </div>
    </div>
  );
}
