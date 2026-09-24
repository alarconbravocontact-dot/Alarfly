import { useCallback, useEffect, useState } from 'react';
import { fxRatesApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';
import StatusSeal from '../../core/ui/StatusSeal';

// Fase 6: el backend de core/fx (registrar/listar tasas, revaluar
// cuentas en moneda extranjera) ya existía completo desde Fase 1/3,
// pero nunca tuvo una pantalla — sin esto, la única forma de registrar
// una tasa BCV era una llamada directa a la API. No se creó ningún
// endpoint nuevo, esta pantalla solo envuelve los 3 que ya existían.
export default function TasasDeCambioPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  const [rates, setRates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [currency, setCurrency] = useState('VES');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [source, setSource] = useState('BCV');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadRates = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await fxRatesApi.list();
      setRates(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las tasas de cambio.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');
    setIsSaving(true);
    try {
      await fxRatesApi.record({ currency: currency.toUpperCase(), rate: Number(rate), date, source });
      setRate('');
      setFormSuccess(`Tasa de ${currency.toUpperCase()} guardada correctamente.`);
      await loadRates();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la tasa.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Registrar tasa de cambio
              <HelpTooltip text="Cada moneda extranjera necesita al menos una tasa registrada para poder convertirla — sin eso, cualquier cobro, pago o reporte en esa moneda se rechaza en vez de inventar un número. Una operación ya registrada NUNCA se recalcula si registras una tasa nueva después: siempre conserva la que estaba vigente en su momento." />
            </h2>
          </div>
          <form onSubmit={handleCreate}>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <label className="field">
                <span>Moneda</span>
                <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="Ej: VES, EUR" required />
              </label>
              <label className="field">
                <span className="field-label">
                  Tasa
                  <HelpTooltip text="Cuántas unidades de la moneda base de la empresa equivalen a 1 unidad de esta moneda. Ej: si la tasa BCV es 45 Bs. por USD y tu moneda base es USD, registra la tasa como 1/45 = 0,0222." />
                </span>
                <input type="number" step="0.000001" min="0.000001" value={rate} onChange={(e) => setRate(e.target.value)} required />
              </label>
              <label className="field">
                <span>Fecha</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">
                  Origen
                  <HelpTooltip text="BCV: la tasa oficial del día. Manual: cualquier otra (ej. una tasa paralela o un acuerdo puntual) — nunca se confunden entre sí." />
                </span>
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="BCV">BCV (oficial)</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </label>
            </div>
            {formError && <p className="alert-box alert-box-error">{formError}</p>}
            {formSuccess && <p className="alert-box alert-box-success">{formSuccess}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Guardar tasa'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Historial de tasas</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && rates.length === 0 && (
          <EmptyState icon="◒" message="Todavía no registraste ninguna tasa de cambio." />
        )}
        {!isLoading && !loadError && rates.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Moneda</th>
                <th className="num">Tasa</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(new Date(r.date))}</td>
                  <td>{r.currency}</td>
                  <td className="num">{Number(r.rate)}</td>
                  <td>
                    <StatusSeal status={r.source === 'BCV' ? 'active' : 'pending'} label={r.source === 'BCV' ? 'BCV' : 'Manual'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
