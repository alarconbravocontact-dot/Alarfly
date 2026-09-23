import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { accountApi } from '../api/account';
import { useAuth } from './AuthContext';

const IncognitoContext = createContext(null);

// Modo incógnito global (Feature V): reemplaza todos los montos
// visibles por asteriscos. El estado en sí (`isIncognito`) es
// deliberadamente transitorio — vive en sessionStorage, no en el
// servidor — porque es un interruptor de "ocúltalo ahora mismo",
// contextual a esta pestaña, no una preferencia que deba seguir al
// usuario entre dispositivos (mismo criterio ya usado para el
// "Descartar" de la barra de progreso inicial). Lo único que SÍ se
// guarda como preferencia real es si debe activarse solo al compartir
// pantalla (`autoIncognitoOnScreenShare`, ver Mi Cuenta > Preferencias).
const STORAGE_KEY = 'alarfly-incognito';

function readStoredState() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function IncognitoProvider({ children }) {
  const { user } = useAuth();
  const [isIncognito, setIsIncognito] = useState(readStoredState);
  const [autoOnScreenShare, setAutoOnScreenShare] = useState(false);
  const [isSharingThisTab, setIsSharingThisTab] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    accountApi
      .getPreferences()
      .then((prefs) => setAutoOnScreenShare(!!prefs.autoIncognitoOnScreenShare))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, isIncognito ? '1' : '0');
    } catch {
      // sessionStorage puede no estar disponible (navegación privada
      // estricta) — el modo incógnito sigue funcionando en memoria.
    }
  }, [isIncognito]);

  function toggle() {
    setIsIncognito((v) => !v);
  }

  // Atajo de teclado rápido: Ctrl/Cmd+Shift+H — con modificadores a
  // propósito (a diferencia del atajo "N" de creación rápida) porque
  // es una acción sensible de seguridad, nunca debe dispararse sin
  // querer mientras alguien escribe.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key.toLowerCase() === 'h' && event.shiftKey && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setIsIncognito((v) => !v);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Innovación pedida explícitamente: activar el modo incógnito solo
  // al compartir pantalla. Los navegadores NO exponen ninguna API para
  // que una página detecte que está siendo compartida desde OTRA
  // pestaña o aplicación (Zoom, Meet, Teams) — es una barrera de
  // privacidad deliberada del navegador, no una limitación de este
  // proyecto (mismo criterio ya documentado para "ubicación
  // aproximada" en Mi Cuenta). Lo único que SÍ es real y detectable
  // con la Screen Capture API (`getDisplayMedia`) es cuando el propio
  // usuario elige compartir ESTA pestaña desde el selector nativo del
  // navegador — `startWatchingThisTab()` la usa para eso.
  async function startWatchingThisTab() {
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    streamRef.current = stream;
    setIsSharingThisTab(true);
    setIsIncognito(true);
    const [track] = stream.getVideoTracks();
    track.addEventListener('ended', () => {
      setIsSharingThisTab(false);
      streamRef.current = null;
    });
  }

  function stopWatchingThisTab() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsSharingThisTab(false);
  }

  async function setAutoOnScreenShareSetting(value) {
    setAutoOnScreenShare(value);
    await accountApi.updatePreferences({ autoIncognitoOnScreenShare: value });
  }

  const value = useMemo(
    () => ({
      isIncognito,
      toggle,
      autoOnScreenShare,
      setAutoOnScreenShareSetting,
      isSharingThisTab,
      startWatchingThisTab,
      stopWatchingThisTab,
      canDetectScreenShare: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isIncognito, autoOnScreenShare, isSharingThisTab]
  );

  return <IncognitoContext.Provider value={value}>{children}</IncognitoContext.Provider>;
}

export function useIncognito() {
  const ctx = useContext(IncognitoContext);
  if (!ctx) throw new Error('useIncognito debe usarse dentro de IncognitoProvider');
  return ctx;
}
