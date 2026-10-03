import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { affiliateSelfApi } from '../api/affiliates';
import { getStoredAffiliate, setAffiliateSession, clearAffiliateSession } from '../api/affiliateAuth';

// Mismo patrón que AuthContext (sesión de empresa), aplicado a la
// sesión del afiliado — contexto aparte a propósito, nunca mezclado
// con `useAuth()`, para que un componente nunca pueda confundir "el
// usuario de la empresa" con "el afiliado" (dos actores que pueden
// incluso coexistir con sesión abierta al mismo tiempo).
const AffiliateAuthContext = createContext(null);

export function AffiliateAuthProvider({ children }) {
  const [affiliate, setAffiliate] = useState(() => getStoredAffiliate());

  const applySession = useCallback((result) => {
    setAffiliateSession(result.token, result.affiliate);
    setAffiliate(result.affiliate);
    return result.affiliate;
  }, []);

  const register = useCallback(
    async (name, email, password, phone) => {
      const result = await affiliateSelfApi.register(name, email, password, phone);
      return applySession(result);
    },
    [applySession]
  );

  const login = useCallback(
    async (email, password) => {
      const result = await affiliateSelfApi.login(email, password);
      return applySession(result);
    },
    [applySession]
  );

  const logout = useCallback(() => {
    clearAffiliateSession();
    setAffiliate(null);
  }, []);

  const value = useMemo(
    () => ({ affiliate, isAffiliateAuthenticated: !!affiliate, register, login, logout }),
    [affiliate, register, login, logout]
  );

  return <AffiliateAuthContext.Provider value={value}>{children}</AffiliateAuthContext.Provider>;
}

export function useAffiliateAuth() {
  const context = useContext(AffiliateAuthContext);
  if (!context) {
    throw new Error('useAffiliateAuth debe usarse dentro de <AffiliateAuthProvider>.');
  }
  return context;
}
