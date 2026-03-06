import { createContext, useContext, useState } from 'react';

const AdblockContext = createContext({ adblockDetected: false, setAdblockDetected: () => {} });

export function AdblockProvider({ children }) {
  const [adblockDetected, setAdblockDetected] = useState(false);
  return (
    <AdblockContext.Provider value={{ adblockDetected, setAdblockDetected }}>
      {children}
    </AdblockContext.Provider>
  );
}

export function useAdblock() {
  return useContext(AdblockContext);
}
