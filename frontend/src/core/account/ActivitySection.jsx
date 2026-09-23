import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { formatDate } from '../../utils/format';
import EmptyState from '../../core/ui/EmptyState';

export default function ActivitySection() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const activityQuery = useQuery({
    queryKey: ['account', 'activity', range],
    queryFn: () => accountApi.listMyActivity({ from: range.from || undefined, to: range.to || undefined }),
  });

  async function handleExport(format) {
    setExportError('');
    setIsExporting(true);
    try {
      await accountApi.exportMyActivity(format, { from: range.from || undefined, to: range.to || undefined });
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'No se pudo exportar tu actividad.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Mi actividad</h2>
      </div>
      <p className="text-muted">Historial de acciones sensibles que realizaste tú mismo en el sistema.</p>

      <div className="form-grid" style={{ marginTop: 12, marginBottom: 16 }}>
        <label className="field">
          <span>Desde</span>
          <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </label>
        <label className="field">
          <span>Hasta</span>
          <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </label>
        <div className="btn-row" style={{ alignItems: 'flex-end' }}>
          <button type="button" className="btn btn-small" disabled={isExporting} onClick={() => handleExport('json')}>
            Exportar JSON
          </button>
          <button type="button" className="btn btn-small" disabled={isExporting} onClick={() => handleExport('csv')}>
            Exportar CSV
          </button>
        </div>
      </div>

      {exportError && <p className="alert-box alert-box-error">{exportError}</p>}

      {activityQuery.isLoading && <p className="text-muted">Cargando…</p>}
      {activityQuery.data && activityQuery.data.length === 0 && (
        <EmptyState icon="◷" message="Todavía no tienes actividad registrada en este rango." />
      )}
      {activityQuery.data && activityQuery.data.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Acción</th>
              <th>Elemento</th>
            </tr>
          </thead>
          <tbody>
            {activityQuery.data.map((log) => (
              <tr key={log.id}>
                <td>{formatDate(new Date(log.createdAt))}</td>
                <td>{log.action}</td>
                <td>{log.entityType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
