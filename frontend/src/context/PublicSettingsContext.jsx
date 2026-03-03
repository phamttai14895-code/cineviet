import { createContext, useContext, useState, useEffect } from 'react';
import { settings as settingsApi } from '../api/client';

const PublicSettingsContext = createContext(null);

export function PublicSettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    settingsApi
      .getPublic()
      .then((r) => {
        const data = r?.data ?? r ?? {};
        setSettings(typeof data === 'object' && data !== null ? data : {});
      })
      .catch(() => setSettings({}));
  }, []);

  return (
    <PublicSettingsContext.Provider value={settings}>
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings() {
  return useContext(PublicSettingsContext);
}

/** URL gốc cho API (ảnh quảng cáo) — dùng relative để luôn cùng origin với trang, tránh CORS */
export function getApiBase() {
  if (typeof window === 'undefined') return '/api';
  if (typeof window.__API_BASE__ === 'string' && window.__API_BASE__.length > 0) {
    return window.__API_BASE__.replace(/\/$/, '') + '/api';
  }
  return '/api';
}
