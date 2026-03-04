import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const openLoginModal = useCallback(() => setLoginModalOpen(true), []);
  const openRegisterModal = useCallback(() => setRegisterModalOpen(true), []);

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await authApi.me();
      if (data && data.id) {
        setUser(data);
      } else {
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
    const onLogout = () => setUser(null);
    window.addEventListener('auth-logout', onLogout);
    return () => window.removeEventListener('auth-logout', onLogout);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser: loadUser, loginModalOpen, setLoginModalOpen, openLoginModal, registerModalOpen, setRegisterModalOpen, openRegisterModal }}>
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuth = {
  user: null,
  loading: false,
  login: () => {},
  logout: () => {},
  refreshUser: () => {},
  loginModalOpen: false,
  setLoginModalOpen: () => {},
  openLoginModal: () => {},
  registerModalOpen: false,
  setRegisterModalOpen: () => {},
  openRegisterModal: () => {},
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) return defaultAuth;
  return ctx;
}
