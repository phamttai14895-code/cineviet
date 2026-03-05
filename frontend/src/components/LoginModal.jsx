import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { auth as authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || '';
const _raw = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').toString().trim();
const TURNSTILE_SITE_KEY = (_raw === '' || _raw === 'undefined' || _raw === 'false') ? '' : _raw;

export default function LoginModal({ open, onClose, onSuccess }) {
  const { login, openRegisterModal } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);
  const turnstileWidgetId = useRef(null);
  const turnstilePollId = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !TURNSTILE_SITE_KEY) return;
    setTurnstileToken('');
    const render = () => {
      if (!window.turnstile || !turnstileRef.current) return;
      if (turnstileWidgetId.current != null) {
        try { window.turnstile.reset(turnstileWidgetId.current); } catch (_) {}
      }
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
      });
    };
    const raf = requestAnimationFrame(() => {
      if (!turnstileRef.current) return;
      if (window.turnstile) {
        render();
      } else {
        turnstilePollId.current = setInterval(() => {
          if (window.turnstile && turnstileRef.current) {
            if (turnstilePollId.current) clearInterval(turnstilePollId.current);
            turnstilePollId.current = null;
            render();
          }
        }, 100);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (turnstilePollId.current) {
        clearInterval(turnstilePollId.current);
        turnstilePollId.current = null;
      }
      if (turnstileWidgetId.current != null && window.turnstile) {
        try { window.turnstile.remove(turnstileWidgetId.current); } catch (_) {}
        turnstileWidgetId.current = null;
      }
    };
  }, [open, TURNSTILE_SITE_KEY]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      const msg = 'Vui lòng hoàn thành xác minh.';
      setError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      const body = { email, password };
      if (TURNSTILE_SITE_KEY) body.turnstile_token = turnstileToken;
      const { data } = await authApi.login(body);
      login(data.user, data.token);
      setSuccess(true);
      toast.success('Đăng nhập thành công!');
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 600);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Đăng nhập thất bại';
      setError(msg);
      toast.error(msg);
      if (TURNSTILE_SITE_KEY && turnstileWidgetId.current != null && window.turnstile) {
        try { window.turnstile.reset(turnstileWidgetId.current); } catch (_) {}
        setTurnstileToken('');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const content = (
    <div className="login-modal-backdrop" onClick={onClose} role="presentation">
      <div className="login-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Đăng nhập">
        <div className="login-modal-left">
          <div className="login-modal-left-bg" />
          <div className="login-modal-left-overlay" />
          <div className="login-modal-left-brand">
            <span className="login-modal-logo">CINEVIET</span>
            <span className="login-modal-tagline">Phim hay mỗi ngày</span>
          </div>
        </div>
        <div className="login-modal-right">
          <div className="login-modal-header">
            <h2>Đăng nhập</h2>
            <button type="button" className="login-modal-close" onClick={onClose} aria-label="Đóng">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="login-modal-body">
          {success ? (
            <p className="login-modal-success-msg">
              <i className="fas fa-check-circle" /> Đăng nhập thành công!
            </p>
          ) : (
            <>
              {error && <p className="login-modal-error">{error}</p>}
              <form onSubmit={handleSubmit}>
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="login-modal-input"
                  />
                </label>
                <label>
                  Mật khẩu
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="login-modal-input"
                  />
                </label>
                {TURNSTILE_SITE_KEY && (
                  <div ref={turnstileRef} className="login-modal-turnstile" aria-label="Xác minh bảo mật" />
                )}
                <button type="submit" className="btn btn-primary login-modal-submit" disabled={loading}>
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </form>
              <div className="login-modal-divider">hoặc</div>
              <div className="login-modal-social">
                <a href={`${API_URL}/api/auth/google`} className="btn-google-login">
                  <svg className="btn-google-icon" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Đăng nhập bằng Google</span>
                </a>
              </div>
              <p className="login-modal-footer">
                Chưa có tài khoản? <button type="button" className="login-modal-link-btn" onClick={() => { onClose?.(); openRegisterModal(); }}>Đăng ký</button>
              </p>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
