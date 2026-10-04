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

// Prompt 2 (UX/Tema): clave pública, para un visitante SIN sesión
// (Landing, Privacidad, Términos, Contacto, 404) — no hay
// `UserPreference` a la cual escribir todavía, así que acá
// `localStorage` SÍ es la fuente de verdad (no solo una copia de
// lectura rápida, como lo es para un usuario autenticado). Si esa
// persona se registra más tarde, su elección pública no se migra
// automáticamente a `UserPreference` — son dos cuentas de
// "quién decide el tema" distintas a propósito (una por dispositivo
// sin sesión, una por usuario con sesión), mismo criterio ya usado por
// el resto del proyecto para no inventar una migración sin que nadie
// la haya pedido.
const PUBLIC_THEME_KEY = 'theme-public';

// La preferencia real de un usuario autenticado vive en el servidor
// (UserPreference.theme, por usuario, no por dispositivo — para que
// persista al entrar desde otro equipo). Este contexto guarda además
// una copia en localStorage (por usuario, o la clave pública sin
// sesión) para poder pintar el tema correcto de inmediato al cargar la
// página, antes de que responda la API — evita un parpadeo del tema
// equivocado. El mismo `<html data-theme>`/el mismo juego de tokens de
// theme.css sirve a los dos casos; nunca se construyó un segundo
// sistema de temas para la parte pública.
export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [rawTheme, setRawTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    // Antes de saber si hay sesión (useAuth todavía no resolvió al
    // usuario en este primer render), se arranca con lo que ya haya en
    // la clave pública — el mismo valor que el script anti-parpadeo de
    // index.html ya usó para fijar `data-theme` antes de que React
    // montara nada, así que este primer render de React ya coincide
    // sin un segundo salto visual. Si hay sesión, el efecto de abajo
    // lo corrige por la preferencia real del servidor apenas responde.
    // Mismo valor por defecto que ya usa el lado autenticado
    // (`UserPreference.theme @default("dark")`, ver schema.prisma) —
    // un visitante público no debe ver un comportamiento distinto del
    // de un usuario con sesión solo por no haberla iniciado todavía.
    return localStorage.getItem(PUBLIC_THEME_KEY) || 'dark';
  });
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
      // Sin sesión: la clave pública YA es la fuente de verdad (no
      // solo una copia de lectura rápida) — se relee acá por si
      // cambió en otra pestaña, nunca se pisa con un valor fijo.
      setRawTheme(localStorage.getItem(PUBLIC_THEME_KEY) || 'dark');
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
    // Mismo ajuste que ya hace el script anti-parpadeo de index.html,
    // repetido acá para que un cambio de tema EN VIVO (el usuario elige
    // otra opción mientras usa la app) también actualice el color de
    // la barra del navegador/la app instalada, no solo la primera carga.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effectiveTheme === 'light' ? '#f6f4ef' : '#0b0d10');
  }, [effectiveTheme]);

  const setTheme = useCallback(
    async (newTheme) => {
      setRawTheme(newTheme);
      if (user) {
        localStorage.setItem(cacheKey(user.id), newTheme);
        await accountApi.updatePreferences({ theme: newTheme });
        return;
      }
      // Sin sesión no hay ningún `UserPreference` al cual escribir
      // (llamar a `accountApi.updatePreferences` acá daría 401) — la
      // clave pública de localStorage es la fuente de verdad completa
      // para un visitante sin cuenta.
      localStorage.setItem(PUBLIC_THEME_KEY, newTheme);
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
