import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { accountApi } from '../api/account';
import { useAuth } from './AuthContext';

const IconLabelContext = createContext(null);

// Sistema de iconografía consistente (Feature Y) — modo "principiante":
// mientras está activo, cada ícono construido con `core/ui/Icon.jsx`
// muestra también su etiqueta de texto al lado, no solo el ícono solo.
// Empieza en `true` (ayuda a un usuario nuevo a aprender qué hace cada
// ícono) y cualquier usuario lo puede apagar una vez que ya los
// reconoce — la preferencia real vive en el servidor
// (`UserPreference.beginnerIconLabels`), no en sessionStorage, porque
// a diferencia del modo incógnito (Feature V, deliberadamente
// transitorio) esto sí debe seguir al usuario entre dispositivos.
export function IconLabelProvider({ children }) {
  const { user } = useAuth();
  const [beginnerMode, setBeginnerModeState] = useState(true);

  useEffect(() => {
    if (!user) return;
    accountApi
      .getPreferences()
      .then((prefs) => setBeginnerModeState(prefs.beginnerIconLabels !== false))
      .catch(() => {});
  }, [user]);

  async function setBeginnerMode(value) {
    setBeginnerModeState(value);
    await accountApi.updatePreferences({ beginnerIconLabels: value });
  }

  const value = useMemo(() => ({ beginnerMode, setBeginnerMode }), [beginnerMode]);

  return <IconLabelContext.Provider value={value}>{children}</IconLabelContext.Provider>;
}

export function useIconLabel() {
  const ctx = useContext(IconLabelContext);
  if (!ctx) throw new Error('useIconLabel debe usarse dentro de IconLabelProvider');
  return ctx;
}
