import { useCallback, useEffect, useState } from 'react';
import { businessMetricsApi } from '../../api/business-metrics';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import MetricTrendChart from '../../components/MetricTrendChart';
import StatCard from '../../components/StatCard';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import Breadcrumb from '../../core/ui/Breadcrumb';

function emptyMetricForm() {
  return { name: '', unit: '', description: '' };
}

// Los números que devuelve el backend vienen con 2-4 decimales fijos
// (precisión exacta para no perder centavos al sumar/promediar) — acá
// solo se recortan los ceros que sobran para que se vean limpios.
function formatMetricValue(value, unit) {
  const trimmed = Number(value).toString();
  return unit ? `${trimmed} ${unit}` : trimmed;
}

function emptyEntryForm() {
  return { date: toIsoDate(new Date()), value: '', note: '' };
}

export default function MetricsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [metrics, setMetrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [metricForm, setMetricForm] = useState(emptyMetricForm());
  const [metricFormError, setMetricFormError] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [entryForm, setEntryForm] = useState(emptyEntryForm());
  const [entryFormError, setEntryFormError] = useState('');
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setMetrics(await businessMetricsApi.list());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las métricas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const selectedMetric = metrics.find((m) => m.id === selectedId) || null;

  const loadDetail = useCallback(async (metricId) => {
    setIsDetailLoading(true);
    try {
      const [entriesData, statsData] = await Promise.all([
        businessMetricsApi.listEntries(metricId),
        businessMetricsApi.getStats(metricId),
      ]);
      setEntries(entriesData);
      setStats(statsData);
    } catch {
      setEntries([]);
      setStats(null);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  function selectMetric(metric) {
    setSelectedId(metric.id);
    setEntryForm(emptyEntryForm());
    setEntryFormError('');
    loadDetail(metric.id);
  }

  async function handleCreateMetric(event) {
    event.preventDefault();
    setMetricFormError('');
    try {
      await businessMetricsApi.create({
        name: metricForm.name,
        unit: metricForm.unit || undefined,
        description: metricForm.description || undefined,
      });
      setMetricForm(emptyMetricForm());
      setIsFormOpen(false);
      await loadMetrics();
    } catch (err) {
      setMetricFormError(err instanceof ApiError ? err.message : 'No se pudo crear la métrica.');
    }
  }

  async function handleToggleActive(metric) {
    if (metric.isActive) {
      const ok = await confirm({
        title: 'Desactivar métrica',
        message: `Vas a desactivar "${metric.name}". Ya no va a aparecer para registrar nuevos valores.`,
        confirmLabel: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await businessMetricsApi.update(metric.id, { isActive: !metric.isActive });
      await loadMetrics();
    } catch {
      // se refleja al recargar
    }
  }

  async function handleAddEntry(event) {
    event.preventDefault();
    setEntryFormError('');
    if (!entryForm.value) {
      setEntryFormError('Escribe un valor.');
      return;
    }
    setIsSavingEntry(true);
    try {
      await businessMetricsApi.addEntry(selectedId, {
        date: entryForm.date,
        value: Number(entryForm.value),
        note: entryForm.note || undefined,
      });
      setEntryForm(emptyEntryForm());
      await loadDetail(selectedId);
    } catch (err) {
      setEntryFormError(err instanceof ApiError ? err.message : 'No se pudo registrar el valor.');
    } finally {
      setIsSavingEntry(false);
    }
  }

  async function handleDeleteEntry(entry) {
    const ok = await confirm({
      title: 'Eliminar registro',
      message: `Vas a eliminar el valor del ${formatDate(new Date(entry.date))}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await businessMetricsApi.deleteEntry(selectedId, entry.id);
      await loadDetail(selectedId);
    } catch {
      // se refleja al recargar
    }
  }

  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Métricas del Negocio' }]} />
      <div className="page-header">
        <h1 className="field-label">
          Métricas del Negocio
          <HelpTooltip text="A diferencia de los reportes de Contabilidad (que se calculan solos a partir de tus asientos), acá escribes tú mismo el número — por ejemplo “Ventas del día” o “Clientes nuevos” — y el sistema te muestra cómo va cambiando en el tiempo." />
        </h1>
        <p className="page-subtitle">Define tus propios indicadores y registra sus valores para ver su evolución.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Mis métricas</h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nueva métrica'}
            </button>
          )}
        </div>

        {isFormOpen && (
          <form onSubmit={handleCreateMetric} className="form-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>Nombre</span>
              <input value={metricForm.name} onChange={(e) => setMetricForm({ ...metricForm, name: e.target.value })} placeholder="Ventas diarias" required />
            </label>
            <label className="field">
              <span className="field-label">
                Unidad (opcional)
                <HelpTooltip text="Solo para mostrarla junto al número, ej. “US$”, “%”, “unidades”. No afecta ningún cálculo." />
              </span>
              <input value={metricForm.unit} onChange={(e) => setMetricForm({ ...metricForm, unit: e.target.value })} placeholder="US$" />
            </label>
            <label className="field" style={{ gridColumn: 'span 2' }}>
              <span>Descripción (opcional)</span>
              <input value={metricForm.description} onChange={(e) => setMetricForm({ ...metricForm, description: e.target.value })} />
            </label>
            {metricFormError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {metricFormError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary btn-small">
                Crear métrica
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && metrics.length === 0 && (
          <EmptyState icon="◷" message="Todavía no creaste ninguna métrica." />
        )}
        {!isLoading && !loadError && metrics.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Unidad</th>
                <th>Estado</th>
                {canManage && <th></th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.id} style={{ background: selectedId === metric.id ? 'var(--color-surface-hover)' : undefined }}>
                  <td>
                    {metric.name}
                    {metric.description && <div className="text-muted">{metric.description}</div>}
                  </td>
                  <td>{metric.unit || '—'}</td>
                  <td>
                    <StatusSeal status={metric.isActive ? 'active' : 'inactive'} label={metric.isActive ? 'Activa' : 'Inactiva'} />
                  </td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => handleToggleActive(metric)}>
                        {metric.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  )}
                  <td>
                    <button type="button" className="btn btn-small btn-primary" onClick={() => selectMetric(metric)}>
                      {selectedId === metric.id ? 'Viendo' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedMetric && (
        <>
          {canManage && (
            <div className="panel">
              <div className="panel-header">
                <h2>Registrar un valor de "{selectedMetric.name}"</h2>
              </div>
              <form onSubmit={handleAddEntry} className="form-grid">
                <label className="field">
                  <span>Fecha</span>
                  <input type="date" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} required />
                </label>
                <label className="field">
                  <span>Valor{selectedMetric.unit ? ` (${selectedMetric.unit})` : ''}</span>
                  <input type="number" step="any" value={entryForm.value} onChange={(e) => setEntryForm({ ...entryForm, value: e.target.value })} required />
                </label>
                <label className="field" style={{ gridColumn: 'span 2' }}>
                  <span>Nota (opcional)</span>
                  <input value={entryForm.note} onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })} />
                </label>
                {entryFormError && (
                  <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                    {entryFormError}
                  </p>
                )}
                <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" className="btn btn-primary btn-small" disabled={isSavingEntry}>
                    {isSavingEntry ? 'Guardando…' : 'Registrar valor'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {isDetailLoading && (
            <div className="panel">
              <p className="text-muted">Cargando…</p>
            </div>
          )}

          {!isDetailLoading && stats && stats.count > 0 && (
            <>
              <div className="panel">
                <div className="panel-header">
                  <h2>Estadísticas</h2>
                </div>
                <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                  <StatCard label="Último valor" value={formatMetricValue(stats.latest.value, selectedMetric.unit)} hint={formatDate(new Date(stats.latest.date))} />
                  <StatCard label="Promedio" value={formatMetricValue(stats.average, selectedMetric.unit)} />
                  <StatCard label="Mínimo" value={formatMetricValue(stats.min.value, selectedMetric.unit)} hint={formatDate(new Date(stats.min.date))} />
                  <StatCard label="Máximo" value={formatMetricValue(stats.max.value, selectedMetric.unit)} hint={formatDate(new Date(stats.max.date))} />
                  <StatCard label="Total acumulado" value={formatMetricValue(stats.total, selectedMetric.unit)} />
                  <StatCard
                    label="Variación (primero → último)"
                    value={`${Number(stats.change.variance) > 0 ? '+' : ''}${formatMetricValue(stats.change.variance, selectedMetric.unit)}`}
                    hint={stats.change.variancePercent !== null ? `${stats.change.variancePercent}%` : null}
                    tone={Number(stats.change.variance) > 0 ? 'positive' : Number(stats.change.variance) < 0 ? 'negative' : 'neutral'}
                  />
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Evolución</h2>
                </div>
                <MetricTrendChart entries={entries} unit={selectedMetric.unit} />
              </div>
            </>
          )}

          <div className="panel">
            <div className="panel-header">
              <h2>Valores registrados</h2>
            </div>
            {!isDetailLoading && entries.length === 0 && (
              <EmptyState icon="○" message="Todavía no registraste ningún valor para esta métrica." />
            )}
            {!isDetailLoading && entries.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="num">Valor</th>
                    <th>Nota</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {[...entries].reverse().map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(new Date(entry.date))}</td>
                      <td className="num">{formatMetricValue(entry.value, selectedMetric.unit)}</td>
                      <td className="text-muted">{entry.note || '—'}</td>
                      {canManage && (
                        <td>
                          <button type="button" className="btn btn-small btn-danger" onClick={() => handleDeleteEntry(entry)}>
                            Eliminar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
