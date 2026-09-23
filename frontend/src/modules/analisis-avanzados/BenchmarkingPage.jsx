import { useEffect, useState } from 'react';
import { benchmarkApi } from '../../api/advanced-analytics';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';

function emptyForm() {
  return { metricKey: '', label: '', industryValue: '', unit: '' };
}

export default function BenchmarkingPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'ADMIN';

  const [benchmarks, setBenchmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  function load() {
    setIsLoading(true);
    benchmarkApi
      .list()
      .then(setBenchmarks)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los valores de referencia.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    try {
      await benchmarkApi.upsert(form.metricKey.trim(), { label: form.label, industryValue: Number(form.industryValue), unit: form.unit || undefined });
      setForm(emptyForm());
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'No se pudo guardar el valor de referencia.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(metricKey, label) {
    const ok = await confirm({
      title: 'Eliminar valor de referencia',
      message: `"${label}" dejará de estar disponible para comparar en Benchmarking. Esto no borra ningún reporte ya generado.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    await benchmarkApi.remove(metricKey);
    load();
  }

  return (
    <div>
      {isAdmin && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Agregar valor de referencia
              <HelpTooltip text="Como no hay acceso a datos de la industria en tiempo real, tú defines el valor típico del sector para comparar tus indicadores contra él." />
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="form-grid">
            <label className="field">
              <span>Clave de la métrica (ej. current_ratio)</span>
              <input type="text" value={form.metricKey} onChange={(e) => setForm({ ...form, metricKey: e.target.value })} required />
            </label>
            <label className="field">
              <span>Nombre visible</span>
              <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
            </label>
            <label className="field">
              <span>Valor de referencia</span>
              <input type="number" step="0.01" value={form.industryValue} onChange={(e) => setForm({ ...form, industryValue: e.target.value })} required />
            </label>
            <label className="field">
              <span>Unidad (opcional, ej. %, x, días)</span>
              <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
            {saveError && <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>{saveError}</p>}
          </form>
        </div>
      )}

      <div className="panel">
        {isLoading && <p className="text-muted">Cargando…</p>}
        {loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && benchmarks.length === 0 && (
          <EmptyState message="Todavía no hay valores de referencia de industria configurados." />
        )}
        {!isLoading && benchmarks.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Nombre</th>
                <th className="num">Valor de referencia</th>
                <th>Unidad</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b) => (
                <tr key={b.metricKey}>
                  <td>{b.metricKey}</td>
                  <td>{b.label}</td>
                  <td className="num">{Number(b.industryValue).toLocaleString('es')}</td>
                  <td>{b.unit || '—'}</td>
                  {isAdmin && (
                    <td>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => handleDelete(b.metricKey, b.label)}>
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
    </div>
  );
}
