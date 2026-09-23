import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import './ToastContext.css';

const ToastContext = createContext(null);

const DEFAULT_DURATION_MS = 5000;

// Sistema de toasts consistente para confirmar acciones exitosas (ej.
// "Cliente creado"), con auto-descarte configurable por llamada
// (`durationMs`, 0 = no se descarta solo) y cierre manual siempre
// disponible. Innovación pedida explícitamente: si la acción confirmada
// tiene un siguiente paso lógico evidente, el propio toast puede traer
// un botón de acción directa (`actionLabel`/`onAction`) — la pantalla
// que llama a `showToast` decide cuál es ese siguiente paso, este
// contexto no lo adivina.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, actionLabel, onAction, durationMs = DEFAULT_DURATION_MS }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, actionLabel, onAction }]);
      if (durationMs) {
        setTimeout(() => dismiss(id), durationMs);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-viewport" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="ui-toast">
            <p className="ui-toast-message">{toast.message}</p>
            <div className="ui-toast-actions">
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  className="ui-toast-action"
                  onClick={() => {
                    dismiss(toast.id);
                    toast.onAction();
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
              <button type="button" className="ui-toast-close" aria-label="Cerrar" onClick={() => dismiss(toast.id)}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  }
  return context;
}
