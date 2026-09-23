import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { accountApi } from '../api/account';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

function resolveSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function cacheKey(userId) {
  return `theme-cache-${userId}`;
}

// La preferencia real vive en el servidor (UserPreference.theme, por
// usuario, no por dispositivo — para que persista al entrar desde otro
// equipo). Este contexto solo guarda una copia en localStorage por
// usuario para poder pintar el tema correcto de inmediato al cargar la
// página, antes de que responda la API (evita un parpadeo del tema
// equivocado) — no es la fuente de verdad.
export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [rawTheme, setRawTheme] = useState('dark');
  const [systemTheme, setSystemTheme] = useState(resolveSystemTheme);

  // "Automático" necesita reevaluarse en vivo si el usuario cambia el
  // horario/ajuste del sistema operativo mientras tiene la app abierta
  // (el caso de uso explícito pedido: alguien revisando números de
  // noche cuando el sistema pasa a modo oscuro).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!user) {
      setRawTheme('dark');
      return;
    }
    const cached = localStorage.getItem(cacheKey(user.id));
    if (cached) setRawTheme(cached);
    accountApi
      .getPreferences()
      .then((prefs) => {
        const theme = prefs?.theme || 'dark';
        setRawTheme(theme);
        localStorage.setItem(cacheKey(user.id), theme);
      })
      .catch(() => {});
  }, [user]);

  const effectiveTheme = rawTheme === 'auto' ? systemTheme : rawTheme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  const setTheme = useCallback(
    async (newTheme) => {
      setRawTheme(newTheme);
      if (user) localStorage.setItem(cacheKey(user.id), newTheme);
      await accountApi.updatePreferences({ theme: newTheme });
    },
    [user]
  );

  const value = useMemo(
    () => ({ rawTheme, effectiveTheme, setTheme }),
    [rawTheme, effectiveTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>.');
  }
  return context;
}
