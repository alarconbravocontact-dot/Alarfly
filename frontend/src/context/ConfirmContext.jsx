import { createContext, useCallback, useContext, useRef, useState } from 'react';
import './ConfirmContext.css';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'default' }) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({ title, message, confirmLabel, cancelLabel, tone });
    });
  }, []);

  function close(result) {
    setDialog(null);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="confirm-overlay" role="presentation" onClick={() => close(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="confirm-dialog-title" className="confirm-dialog-title">
              {dialog.title}
            </p>
            <p className="confirm-dialog-message">{dialog.message}</p>
            <div className="confirm-dialog-actions">
              <button type="button" className="btn" onClick={() => close(false)}>
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                className={`btn ${dialog.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(true)}
                autoFocus
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>.');
  }
  return context;
}
