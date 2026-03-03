import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

const TOAST_TTL_MS = 4000;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const add = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, type }]);
    const t = setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, TOAST_TTL_MS);
    return () => clearTimeout(t);
  }, []);

  const toast = useCallback(
    {
      success: (msg) => add(msg, 'success'),
      error: (msg) => add(msg, 'error'),
      info: (msg) => add(msg, 'info'),
    },
    [add]
  );

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, add }}>
      {children}
      <ToastList items={items} onClose={remove} />
    </ToastContext.Provider>
  );
}

function ToastList({ items, onClose }) {
  if (items.length === 0) return null;
  return (
    <div className="toast-container" role="region" aria-label="Thông báo">
      {items.map(({ id, message, type }) => (
        <div key={id} className={`toast-item toast-${type}`}>
          <span className="toast-icon">
            {type === 'success' && <i className="fas fa-check-circle" />}
            {type === 'error' && <i className="fas fa-exclamation-circle" />}
            {type === 'info' && <i className="fas fa-info-circle" />}
          </span>
          <span className="toast-message">{message}</span>
          <button type="button" className="toast-close" onClick={() => onClose(id)} aria-label="Đóng">
            <i className="fas fa-times" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: { success: () => {}, error: () => {}, info: () => {} } };
  return ctx;
}
