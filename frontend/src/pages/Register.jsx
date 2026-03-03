import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth as authApi, settings as settingsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Register() {
  const { login, openLoginModal } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [allowRegister, setAllowRegister] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    settingsApi.getPublic().then((r) => {
      setAllowRegister(r.data?.allow_register !== false);
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 6) {
      const msg = 'Mật khẩu tối thiểu 6 ký tự';
      setError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.register({ name, email, password });
      login(data.user, data.token);
      setSuccess('Đăng ký thành công!');
      toast.success('Đăng ký thành công!');
      setTimeout(() => {
        navigate('/');
      }, 800);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Đăng ký thất bại';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (settingsLoaded && !allowRegister) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Đăng ký</h1>
          <p className="auth-error">Tạm thời không mở đăng ký tài khoản mới. Vui lòng quay lại sau.</p>
          <p><Link to="/login">Đăng nhập</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Đăng ký</h1>
        {error && <p className="auth-error">{error}</p>}
        {success && (
          <div className="auth-toast auth-toast-success">
            <div className="auth-toast-icon">
              <i className="fas fa-check" />
            </div>
            <div className="auth-toast-text">
              <strong>Thành công!</strong>
              <span>{success}</span>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label>
            Họ tên
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
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
            />
          </label>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>
        <p className="auth-footer">
          Đã có tài khoản? <button type="button" className="auth-link-button" onClick={() => { openLoginModal(); navigate('/'); }}>Đăng nhập</button>
        </p>
      </div>
    </div>
  );
}
