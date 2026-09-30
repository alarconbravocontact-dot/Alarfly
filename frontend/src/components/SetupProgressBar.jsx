import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi } from '../api/account';
import { useAuth } from '../context/AuthContext';
import './SetupProgressBar.css';

function dismissKey(userId) {
  return `setup-progress-dismissed-${userId}`;
}

// Reintenta cargar el estado cada cierto tiempo mientras la barra está
// visible, para que un checkmark se ponga verde solo (sin recargar la
// página) apenas el usuario complete la acción real en otra pestaña o
// en otra pantalla de la misma sesión.
const REFRESH_MS = 20000;

export default function SetupProgressBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [isDismissed, setIsDismissed] = useState(
    () => user && sessionStorage.getItem(dismissKey(user.id)) === '1'
  );

  useEffect(() => {
    if (!user) return undefined;
    let isMounted = true;

    async function load() {
      try {
        const result = await accountApi.getSetupStatus();
        if (isMounted) setStatus(result);
      } catch {
        // Si no se puede cargar el estado, simplemente no se muestra la
        // barra — no es información crítica para poder usar el resto
        // del Panel principal.
      }
    }

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  if (!user || !status || status.allDone || isDismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem(dismissKey(user.id), '1');
    setIsDismissed(true);
  }

  return (
    <div className="setup-progress-bar" role="status">
      <div className="setup-progress-bar-header">
        <div>
          <h2>Termina de configurar tu empresa</h2>
          <p>
            {status.completedCount} de {status.totalCount} pasos completos — se marcan solos apenas los hagas, no
            hace falta avisarnos.
          </p>
        </div>
        <button type="button" className="setup-progress-bar-dismiss" onClick={handleDismiss} aria-label="Descartar">
          Descartar
        </button>
      </div>
      <ol className="setup-progress-bar-steps">
        {status.steps.map((step) => (
          <li key={step.key} className={step.done ? 'is-done' : ''}>
            <span className="setup-progress-bar-check" aria-hidden="true">
              {step.done ? '✓' : ''}
            </span>
            <div className="setup-progress-bar-step-body">
              <span className="setup-progress-bar-step-label">{step.label}</span>
              {!step.done && <span className="setup-progress-bar-step-description">{step.description}</span>}
            </div>
            {!step.done && step.path && (
              <button type="button" className="setup-progress-bar-step-go" onClick={() => navigate(step.path)}>
                Ir →
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
