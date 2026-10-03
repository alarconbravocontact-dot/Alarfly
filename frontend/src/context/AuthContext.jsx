import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../api/client';
import { getStoredUser, setSession, clearSession } from '../api/client';

const ROLE_LABELS = {
  ADMIN: 'Administrador',
  ACCOUNTANT: 'Contador',
  FINANCE: 'Financiero',
  COLLABORATOR: 'Colaborador',
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  const applySession = useCallback((result) => {
    setSession(result.token, result.user);
    setUser(result.user);
    return result.user;
  }, []);

  // Si el usuario activó la verificación en dos pasos (Mi Cuenta), esto
  // devuelve { requiresTwoFactor: true, pendingToken } en vez de una
  // sesión — la pantalla de Acceso pide el código y llama a
  // completeTwoFactorLogin con ese pendingToken.
  const login = useCallback(
    async (email, password) => {
      const result = await api.post('/auth/login', { email, password });
      if (result.requiresTwoFactor) {
        return result;
      }
      return applySession(result);
    },
    [applySession]
  );

  const completeTwoFactorLogin = useCallback(
    async (pendingToken, code) => {
      const result = await api.post('/auth/verify-2fa', { pendingToken, code });
      return applySession(result);
    },
    [applySession]
  );

  // F17-E8: el backend ya devolvía una sesión completa al aceptar una
  // invitación (igual que login), pero no existía ningún punto del
  // frontend que la consumiera — se agrega acá con el mismo patrón que
  // el resto de `AuthContext`.
  const acceptInvitation = useCallback(
    async (token, password) => {
      const result = await api.post('/auth/accept-invitation', { token, password });
      return applySession(result);
    },
    [applySession]
  );

  // Fase Landing — Registro Público: mismo patrón que acceptInvitation
  // (el backend ya entrega una sesión completa al crear la empresa).
  const signup = useCallback(
    async (companyName, name, email, password) => {
      const result = await api.post('/auth/signup', { companyName, name, email, password });
      return applySession(result);
    },
    [applySession]
  );

  const logout = useCallback(() => {
    // La barra de progreso de configuración inicial (Panel principal)
    // se puede descartar por la sesión actual — al cerrar sesión, ese
    // descarte se olvida, para que vuelva a aparecer en el próximo
    // inicio de sesión si el setup sigue incompleto.
    if (user) sessionStorage.removeItem(`setup-progress-dismissed-${user.id}`);
    clearSession();
    setUser(null);
  }, [user]);

  // Usado por Mi Cuenta al actualizar el nombre (para que el topbar
  // refleje el cambio sin recargar la página) y al cambiar de empresa
  // activa (que reemite el token con el nuevo companyId).
  const refreshUser = useCallback(
    (result) => {
      if (result.token) return applySession(result);
      setUser((prev) => ({ ...prev, ...result }));
      return result;
    },
    [applySession]
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      roleLabel: user ? ROLE_LABELS[user.role] || user.role : null,
      login,
      completeTwoFactorLogin,
      acceptInvitation,
      signup,
      logout,
      refreshUser,
    }),
    [user, login, completeTwoFactorLogin, acceptInvitation, signup, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return context;
}
