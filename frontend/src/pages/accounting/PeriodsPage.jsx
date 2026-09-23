import { useCallback, useEffect, useState } from 'react';
import { periodsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

export default function PeriodsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';
  const isAdmin = user?.role === 'ADMIN';

  const [periods, setPeriods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rowError, setRowError] = useState({});
  const [reopeningId, setReopeningId] = useState(null);
  const [reopenReason, setReopenReason] = useState('');

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(toIsoDate(new Date()));
  const [endDate, setEndDate] = useState(toIsoDate(new Date()));
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadPeriods = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await periodsApi.list();
      setPeriods(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los periodos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await periodsApi.create({ name, startDate, endDate });
      setName('');
      await loadPeriods();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el periodo.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClose(period) {
    const ok = await confirm({
      title: 'Cerrar periodo',
      message: `Vas a cerrar "${period.name}". Mientras esté cerrado, no se podrán registrar ni aprobar asientos con fecha dentro de este periodo.`,
      confirmLabel: 'Cerrar periodo',
      tone: 'danger',
    });
    if (!ok) return;

    setRowError((prev) => ({ ...prev, [period.id]: '' }));
    try {
      await periodsApi.close(period.id);
      await loadPeriods();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [period.id]: err instanceof ApiError ? err.message : 'No se pudo cerrar el periodo.',
      }));
    }
  }

  async function handleReopen(period) {
    if (!reopenReason.trim()) {
      setRowError((prev) => ({ ...prev, [period.id]: 'Debes indicar el motivo para reabrir el periodo.' }));
      return;
    }
    setRowError((prev) => ({ ...prev, [period.id]: '' }));
    try {
      await periodsApi.reopen(period.id, reopenReason);
      setReopeningId(null);
      setReopenReason('');
      await loadPeriods();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [period.id]: err instanceof ApiError ? err.message : 'No se pudo reabrir el periodo.',
      }));
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2>Crear periodo</h2>
          </div>
          <form onSubmit={handleCreate} className="form-grid">
            <label className="field">
              <span>Nombre</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agosto 2026" required />
            </label>
            <label className="field">
              <span>Fecha de inicio</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </label>
            <label className="field">
              <span>Fecha de fin</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </label>
          </form>
          {formError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{formError}</p>}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Crear periodo'}
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Periodos contables</h2>
        </div>

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && periods.length === 0 && (
          <EmptyState icon="▲" message="Todavía no creaste ningún periodo contable." />
        )}

        {!isLoading && !loadError && periods.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>
                  <span className="field-label">
                    Estado
                    <HelpTooltip text="Un periodo Abierto permite registrar y aprobar asientos con fecha dentro de ese rango. Un periodo Cerrado ya no acepta cambios — se usa para “cerrar” un mes o año una vez que ya se revisó todo." />
                  </span>
                </th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id}>
                  <td>{period.name}</td>
                  <td>{formatDate(new Date(period.startDate))}</td>
                  <td>{formatDate(new Date(period.endDate))}</td>
                  <td>
                    <StatusSeal
                      status={period.status === 'OPEN' ? 'open' : 'closed'}
                      label={period.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                    />
                  </td>
                  {canManage && (
                    <td>
                      {period.status === 'OPEN' && (
                        <button type="button" className="btn btn-small" onClick={() => handleClose(period)}>
                          Cerrar
                        </button>
                      )}
                      {period.status === 'CLOSED' && isAdmin && reopeningId !== period.id && (
                        <button type="button" className="btn btn-small" onClick={() => setReopeningId(period.id)}>
                          Reabrir
                        </button>
                      )}
                      {period.status === 'CLOSED' && isAdmin && reopeningId === period.id && (
                        <div className="btn-row">
                          <input
                            placeholder="Motivo para reabrir"
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            style={{
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 9px',
                            }}
                          />
                          <button type="button" className="btn btn-small btn-primary" onClick={() => handleReopen(period)}>
                            Confirmar
                          </button>
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => {
                              setReopeningId(null);
                              setReopenReason('');
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      {rowError[period.id] && (
                        <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                          {rowError[period.id]}
                        </p>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
