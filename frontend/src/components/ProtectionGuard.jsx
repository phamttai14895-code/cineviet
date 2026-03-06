import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePublicSettings } from '../context/PublicSettingsContext';
import { useAdblock } from '../context/AdblockContext';

/**
 * Áp dụng cài đặt bảo vệ từ admin: thông báo adblock, chặn chuột phải, F12, Ctrl+U, v.v.
 * Không chạy khi đang ở trang admin.
 */
export default function ProtectionGuard() {
  const location = useLocation();
  const settings = usePublicSettings();
  const { adblockDetected, setAdblockDetected } = useAdblock();
  const [adblockNoticeDismissed, setAdblockNoticeDismissed] = useState(false);

  const isAdmin = location.pathname.startsWith('/admin');
  const antiAdblock = !isAdmin && settings?.protection_anti_adblock_notice === true;
  const blockRightClick = !isAdmin && settings?.protection_block_right_click === true;
  const blockDevtools = !isAdmin && settings?.protection_block_devtools === true;
  const blockViewSource = !isAdmin && settings?.protection_block_view_source === true;

  // Phát hiện trình chặn quảng cáo (bait element mà adblock thường ẩn) — cập nhật context để trang Watch chặn video
  useEffect(() => {
    if (!antiAdblock) return;
    const check = () => {
      const bait = document.createElement('div');
      bait.className = 'adsbox ad-container ad-placeholder';
      bait.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
      bait.setAttribute('data-adblock-test', '1');
      document.body.appendChild(bait);
      const style = window.getComputedStyle(bait);
      const hidden = bait.offsetHeight === 0 || style.display === 'none' || style.visibility === 'hidden' || bait.offsetParent === null;
      try {
        if (bait.parentNode) bait.parentNode.removeChild(bait);
      } catch (_) {}
      if (hidden) setAdblockDetected(true);
    };
    const t = setTimeout(check, 1500);
    return () => clearTimeout(t);
  }, [antiAdblock, setAdblockDetected]);

  // Chặn chuột phải
  useEffect(() => {
    if (!blockRightClick) return;
    const onContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, [blockRightClick]);

  // Chặn F12, Ctrl+Shift+I, Ctrl+Shift+J
  useEffect(() => {
    if (!blockDevtools) return;
    const onKeyDown = (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'i' || e.key === 'j')) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [blockDevtools]);

  // Chặn Ctrl+U (xem mã nguồn)
  useEffect(() => {
    if (!blockViewSource) return;
    const onKeyDown = (e) => {
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [blockViewSource]);

  const showAdblockNotice = antiAdblock && adblockDetected && !adblockNoticeDismissed;

  return (
    <>
      {showAdblockNotice && (
        <div className="protection-adblock-notice" role="alert">
          <div className="protection-adblock-notice-inner">
            <p className="protection-adblock-notice-text">
              Trang web hoạt động tốt nhất khi bạn tắt trình chặn quảng cáo (AdBlock) cho trang này. 
              Vui lòng tắt chặn quảng cáo để tiếp tục trải nghiệm.
            </p>
            <button
              type="button"
              className="protection-adblock-notice-close"
              onClick={() => setAdblockNoticeDismissed(true)}
              aria-label="Đóng thông báo"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
