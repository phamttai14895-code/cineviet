import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth as authApi } from '../api/client';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { login, openLoginModal } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      openLoginModal();
      navigate('/', { replace: true });
      return;
    }
    localStorage.setItem('token', token);
    authApi.me()
      .then(({ data }) => {
        login(data, token);
        navigate('/', { replace: true });
      })
      .catch(() => {
        openLoginModal();
        navigate('/', { replace: true });
      });
  }, [searchParams, login, navigate, openLoginModal]);

  return <div className="container loading-wrap">Đang xử lý đăng nhập...</div>;
}
