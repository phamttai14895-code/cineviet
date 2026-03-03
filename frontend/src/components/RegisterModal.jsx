import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { auth as authApi, settings as settingsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PIN_LENGTH = 6;
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

export default function RegisterModal({ open, onClose, onSuccess }) {
  const { login, openLoginModal, setRegisterModalOpen, setLoginModalOpen } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [allowRegister, setAllowRegister] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [step, setStep] = useState('form');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [pin, setPin] = useState(Array(PIN_LENGTH).fill(''));
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const pinInputRefs = useRef([]);
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
    if (!open) return;
    setSettingsLoaded(false);
    setStep('form');
    setPin(Array(PIN_LENGTH).fill(''));
    setVerifyEmail('');
    setTurnstileToken('');
    settingsApi.getPublic().then((r) => {
      setAllowRegister(r.data?.allow_register !== false);
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));
  }, [open]);

  useEffect(() => {
    const formVisible = open && step === 'form' && settingsLoaded && allowRegister && TURNSTILE_SITE_KEY;
    if (!formVisible) return;
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
    if (turnstilePollId.current) {
      clearInterval(turnstilePollId.current);
      turnstilePollId.current = null;
    }
    if (window.turnstile) {
      requestAnimationFrame(() => { if (turnstileRef.current) render(); });
    } else {
      turnstilePollId.current = setInterval(() => {
        if (window.turnstile && turnstileRef.current) {
          clearInterval(turnstilePollId.current);
          turnstilePollId.current = null;
          render();
        }
      }, 100);
    }
    return () => {
      if (turnstilePollId.current) {
        clearInterval(turnstilePollId.current);
        turnstilePollId.current = null;
      }
      if (turnstileWidgetId.current != null && window.turnstile) {
        try { window.turnstile.remove(turnstileWidgetId.current); } catch (_) {}
        turnstileWidgetId.current = null;
      }
    };
  }, [open, step, settingsLoaded, allowRegister, TURNSTILE_SITE_KEY]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (password.length < 6) {
      const msg = 'Mật khẩu tối thiểu 6 ký tự';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (password !== confirmPassword) {
      const msg = 'Hai mật khẩu không trùng khớp';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      const msg = 'Vui lòng hoàn thành xác minh.';
      setError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      const body = { name, email, password };
      if (TURNSTILE_SITE_KEY) body.turnstile_token = turnstileToken;
      const { data } = await authApi.register(body);
      login(data.user, data.token);
      if (data.requireEmailVerification) {
        setVerifyEmail(email);
        setStep('verify');
        setError('');
        toast.success('Đăng ký thành công! Kiểm tra email để lấy mã xác thực.');
      } else {
        setSuccess(true);
        toast.success('Đăng ký thành công!');
        setTimeout(() => {
          onSuccess?.();
          onClose?.();
        }, 600);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Đăng ký thất bại';
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

  const handlePinChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...pin];
    next[index] = value.slice(-1);
    setPin(next);
    setError('');
    if (value && index < PIN_LENGTH - 1) pinInputRefs.current[index + 1]?.focus();
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
      const next = [...pin];
      next[index - 1] = '';
      setPin(next);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    const code = pin.join('');
    if (code.length !== PIN_LENGTH) {
      setError('Vui lòng nhập đủ 6 chữ số');
      toast.error('Vui lòng nhập đủ 6 chữ số');
      return;
    }
    setVerifyLoading(true);
    setError('');
    try {
      await authApi.verifyEmail(code);
      setSuccess(true);
      toast.success('Xác thực email thành công!');
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 600);
    } catch (err) {
      const msg = err.response?.data?.error || 'Mã xác thực không đúng';
      setError(msg);
      toast.error(msg);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    setResendLoading(true);
    setError('');
    try {
      await authApi.resendVerification();
      toast.success('Đã gửi lại mã xác thực vào email của bạn.');
      setPin(Array(PIN_LENGTH).fill(''));
      pinInputRefs.current[0]?.focus();
    } catch (err) {
      const msg = err.response?.data?.error || 'Gửi lại thất bại';
      setError(msg);
      toast.error(msg);
    } finally {
      setResendLoading(false);
    }
  };

  const handleOpenLogin = () => {
    setRegisterModalOpen(false);
    setLoginModalOpen(true);
    onClose?.();
  };

  if (!open) return null;

  const content = (
    <div className="login-modal-backdrop" onClick={onClose} role="presentation">
      <div className="login-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Đăng ký">
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
            <h2>Đăng ký</h2>
            <button type="button" className="login-modal-close" onClick={onClose} aria-label="Đóng">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="login-modal-body">
            {!settingsLoaded ? (
              <p className="login-modal-loading">Đang tải...</p>
            ) : !allowRegister ? (
              <p className="login-modal-error">Tạm thời không mở đăng ký tài khoản mới. Vui lòng quay lại sau.</p>
            ) : success ? (
              <p className="login-modal-success-msg">
                <i className="fas fa-check-circle" /> Đăng ký thành công!
              </p>
            ) : step === 'verify' ? (
              <div className="email-verify-block">
                <div className="email-verify-icon" aria-hidden>
                  <i className="fas fa-envelope" />
                </div>
                <h3 className="email-verify-title">Xác thực email</h3>
                <p className="email-verify-text">
                  Chúng tôi đã gửi mã PIN 6 số đến
                  <br />
                  <strong className="email-verify-email">{verifyEmail}</strong>
                </p>
                {error && <p className="login-modal-error">{error}</p>}
                <form onSubmit={handleVerifySubmit} className="email-verify-form">
                  <div className="email-verify-pins">
                    {pin.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { pinInputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePinChange(i, e.target.value)}
                        onKeyDown={(e) => handlePinKeyDown(i, e)}
                        className="email-verify-pin-input"
                        aria-label={`Chữ số ${i + 1}`}
                      />
                    ))}
                  </div>
                  <button type="submit" className="btn btn-primary login-modal-submit email-verify-submit" disabled={verifyLoading}>
                    {verifyLoading ? 'Đang xác thực...' : 'Xác thực'}
                  </button>
                </form>
                <p className="email-verify-resend">
                  Không nhận được mã?{' '}
                  <button type="button" className="email-verify-resend-btn" onClick={handleResend} disabled={resendLoading}>
                    Gửi lại
                  </button>
                </p>
              </div>
            ) : (
              <>
                {error && <p className="login-modal-error">{error}</p>}
                <form onSubmit={handleSubmit}>
                  <label>
                    Tên hiển thị
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      className="login-modal-input"
                    />
                  </label>
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
                    Mật khẩu (tối thiểu 6 ký tự)
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="login-modal-input"
                    />
                  </label>
                  <label>
                    Nhập lại mật khẩu
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="login-modal-input"
                      placeholder="Gõ lại mật khẩu để xác nhận"
                    />
                  </label>
                  {TURNSTILE_SITE_KEY && (
                    <div ref={turnstileRef} className="login-modal-turnstile" aria-label="Xác minh bảo mật" />
                  )}
                  <button type="submit" className="btn btn-primary login-modal-submit" disabled={loading}>
                    {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                  </button>
                </form>
                <p className="login-modal-footer">
                  Đã có tài khoản? <button type="button" className="login-modal-link-btn" onClick={handleOpenLogin}>Đăng nhập</button>
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
