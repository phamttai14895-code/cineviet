import { createContext, useContext, useState, useCallback } from 'react';

const BreadcrumbContext = createContext(null);

export function BreadcrumbProvider({ children }) {
  const [items, setItems] = useState([]);
  const setBreadcrumbItems = useCallback((next) => {
    setItems(Array.isArray(next) ? next : []);
  }, []);
  return (
    <BreadcrumbContext.Provider value={{ items, setBreadcrumbItems }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
