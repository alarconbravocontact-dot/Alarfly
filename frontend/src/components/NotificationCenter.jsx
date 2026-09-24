import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import { ApiError } from '../api/client';
import { alertLink } from '../config/alertLinks';
import Icon from '../core/ui/Icon';
import './NotificationCenter.css';

const SEVERITY_DOT = { CRITICAL: 'is-critical', WARNING: 'is-warning', INFO: 'is-info' };

export default function NotificationCenter() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  function loadActive() {
    setIsLoading(true);
    setError('');
    notificationsApi
      .list({ status: 'ACTIVE' })
      .then(setAlerts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las notificaciones.'))
      .finally(() => setIsLoading(false));
  }

  // Carga el conteo/lista al montar y cada 60s mientras la app está
  // abierta, para que la insignia refleje alertas nuevas sin que el
  // usuario tenga que recargar la página.
  useEffect(() => {
    loadActive();
    const interval = setInterval(loadActive, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleAcknowledge(event, alert) {
    event.stopPropagation();
    try {
      await notificationsApi.acknowledge(alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch {
      // se refleja solo al recargar si falla
    }
  }

  function handleGoTo(alert) {
    setIsOpen(false);
    navigate(alertLink(alert.type));
  }

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        type="button"
        className="notification-center-bell"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Centro de notificaciones"
        aria-expanded={isOpen}
      >
        <Icon name="bell" label="Notificaciones" />
        {alerts.length > 0 && <span className="notification-center-badge">{alerts.length > 9 ? '9+' : alerts.length}</span>}
      </button>
      {isOpen && (
        <div className="notification-center-panel">
          <p className="notification-center-title">Notificaciones</p>
          {isLoading && <p className="text-muted" style={{ padding: '8px 12px' }}>Cargando…</p>}
          {!isLoading && error && (
            <p className="alert-box alert-box-error" style={{ margin: 8 }}>
              {error}
            </p>
          )}
          {!isLoading && !error && alerts.length === 0 && (
            <p className="text-muted" style={{ padding: '8px 12px' }}>
              No tienes notificaciones activas.
            </p>
          )}
          {!isLoading &&
            !error &&
            alerts.map((alert) => (
              <div key={alert.id} className="notification-center-item" onClick={() => handleGoTo(alert)}>
                <span className={`notification-center-dot ${SEVERITY_DOT[alert.severity] || 'is-info'}`} aria-hidden="true" />
                <span className="notification-center-message">{alert.message}</span>
                <button
                  type="button"
                  className="notification-center-ack"
                  onClick={(e) => handleAcknowledge(e, alert)}
                  title="Marcar como atendida"
                  aria-label="Marcar como atendida"
                >
                  <Icon name="check" label="Atendida" />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
