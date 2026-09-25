import { Fragment, useCallback, useEffect, useState } from 'react';
import { auditApi, jobsApi } from '../../api/audit';
import { ApiError } from '../../api/client';
import DateRangeSelector from '../../core/ui/DateRangeSelector';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import HelpTooltip from '../../components/HelpTooltip';
import Breadcrumb from '../../core/ui/Breadcrumb';

// Fase 11 (secciones 14/17/23 — "Audit filters", "Jobs/lastRunAt", "UX
// de auditoría"): antes de esta fase no existía NINGUNA pantalla que
// mostrara la bitácora general de la empresa (solo la actividad
// PERSONAL de Mi Cuenta) ni el estado de los 9 jobs automáticos — esta
// pantalla es solo lectura sobre `core/audit`/`core/jobs`, no un motor
// nuevo. Dos pestañas internas (mismo patrón ya usado por
// `MovementsPage`/`FiscalBooksPage`: un selector de modo con
// `.module-tab` sobre un `<button>`, no navegación real).
function formatDateTime(value) {
  return new Date(value).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

function LogTrail() {
  const [logs, setLogs] = useState([]);
  const [range, setRange] = useState(null);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await auditApi.list({
        entityType: entityType || undefined,
        action: action || undefined,
        from: range?.from,
        to: range?.to,
      });
      setLogs(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la bitácora de auditoría.');
    } finally {
      setIsLoading(false);
    }
  }, [entityType, action, range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <label className="field">
          <span>Tipo de entidad</span>
          <input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="ej. JournalEntry, PaymentOrder" />
        </label>
        <label className="field">
          <span>Acción</span>
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="ej. payment_order.rejected" />
        </label>
        <label className="field" style={{ gridColumn: 'span 2' }}>
          <span>Rango de fechas</span>
          <DateRangeSelector value={range} onChange={setRange} initialKey="custom" />
        </label>
      </div>

      {isLoading && <p className="text-muted">Cargando…</p>}
      {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
      {!isLoading && !loadError && logs.length === 0 && (
        <EmptyState icon="▤" message="No hay eventos de auditoría con estos filtros." />
      )}
      {!isLoading && !loadError && logs.length > 0 && (
        <>
          <p className="text-muted" style={{ marginBottom: 8 }}>
            {logs.length} evento(s) — muestra hasta 200 a la vez, el rango más reciente primero.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Quién</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.user?.name || 'Sistema (automático)'}</td>
                    <td>{log.action}</td>
                    <td>
                      {log.entityType} · {log.entityId}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        {expandedId === log.id ? 'Ocultar' : 'Ver detalle'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr>
                      <td colSpan={5}>
                        <div className="form-grid">
                          <div>
                            <strong>Antes</strong>
                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                              {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <strong>Después</strong>
                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                              {log.newValue ? JSON.stringify(log.newValue, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

function JobsStatus() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setIsLoading(true);
    jobsApi
      .status()
      .then(setJobs)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el estado de los trabajos automáticos.'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <p className="text-muted">Cargando…</p>;
  if (loadError) return <p className="alert-box alert-box-error">{loadError}</p>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Trabajo</th>
          <th>Módulo</th>
          <th>Horario</th>
          <th>Última corrida</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.key}>
            <td>{job.label}</td>
            <td>{job.module}</td>
            <td>{job.scheduleLabel}</td>
            <td>
              {job.lastRun ? (
                <>
                  {formatDateTime(job.lastRun.startedAt)}
                  <div className="text-muted">{job.lastRun.durationMs} ms</div>
                </>
              ) : (
                'Nunca corrió'
              )}
            </td>
            <td>
              {!job.lastRun && <StatusSeal status="pending" label="Sin corridas" />}
              {job.lastRun?.status === 'SUCCESS' && <StatusSeal status="approved" label="Exitosa" />}
              {job.lastRun?.status === 'ERROR' && (
                <>
                  <StatusSeal status="rejected" label="Con error" />
                  <div className="text-muted" style={{ marginTop: 4 }}>
                    {job.lastRun.errorMessage}
                  </div>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AuditTrailPage() {
  const [mode, setMode] = useState('log');

  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Auditoría' }]} />
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Auditoría y control
            <HelpTooltip text="Un registro de todo lo importante que pasó en tu empresa dentro del sistema: quién hizo qué, cuándo, y qué cambió. Solo lo puede ver el Administrador." />
          </h2>
        </div>
        <div className="btn-row" style={{ marginBottom: 16 }}>
          <button type="button" className={`module-tab${mode === 'log' ? ' is-active' : ''}`} onClick={() => setMode('log')}>
            Bitácora
          </button>
          <button type="button" className={`module-tab${mode === 'jobs' ? ' is-active' : ''}`} onClick={() => setMode('jobs')}>
            Trabajos Automáticos
          </button>
        </div>
        {mode === 'log' ? <LogTrail /> : <JobsStatus />}
      </div>
    </div>
  );
}
