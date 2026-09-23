import { useNavigate } from 'react-router-dom';
import './SyncIndicator.css';

const LABELS = {
  GREEN: 'Conectado y actualizado',
  YELLOW: 'Sincronizando',
  RED: 'Conexión caída',
};

function formatLastSync(lastSyncAt) {
  if (!lastSyncAt) return 'nunca se importó un extracto';
  return `último extracto: ${new Date(lastSyncAt).toLocaleString('es')}`;
}

// Indicador verde/amarillo/rojo junto a cada cuenta bancaria, derivado
// de cuándo se importó el último extracto real (no hay feed bancario
// en tiempo real en este proyecto — ver bank-sync.rules.js en el
// backend, la misma honestidad se refleja acá). Un indicador rojo es
// un botón real: lleva directo al flujo de reconexión (importar un
// extracto nuevo en Conciliación Bancaria).
export default function SyncIndicator({ status, lastSyncAt }) {
  const navigate = useNavigate();
  const title = `${LABELS[status] || status} — ${formatLastSync(lastSyncAt)}`;

  if (status === 'RED') {
    return (
      <button
        type="button"
        className="sync-indicator"
        title={`${title}. Haz clic para reconectar (importar un extracto nuevo).`}
        onClick={() => navigate('/tesoreria/conciliacion')}
      >
        <span className="sync-indicator-dot sync-indicator-dot--RED" />
        {LABELS.RED}
      </button>
    );
  }

  return (
    <span className="sync-indicator" title={title}>
      <span className={`sync-indicator-dot sync-indicator-dot--${status}`} />
      {LABELS[status] || status}
    </span>
  );
}
