import { useCallback, useEffect, useState } from 'react';
import { periodsApi, fxRatesApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

// Simplificación pedida explícitamente por el usuario ("menos pestañas/
// clics"): Periodos y Tasas de Cambio eran 2 pestañas separadas de baja
// frecuencia de uso (se tocan una vez al mes, no todos los días como
// Plan de Cuentas/Asientos) — se fusionan en una sola pantalla de
// "Configuración", una debajo de la otra, sin pestaña extra ni clic
// extra para ver ambas. Ninguna lógica cambió, solo se unieron los dos
// componentes que antes vivían en PeriodsPage.jsx/TasasDeCambioPage.jsx.

function PeriodsSection() {
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
    <div className="panel">
      <div className="panel-header">
        <h2>Periodos contables</h2>
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 16 }}>
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
      )}
      {canManage && formError && <p className="alert-box alert-box-error">{formError}</p>}
      {canManage && (
        <div className="btn-row" style={{ marginBottom: 16 }}>
          <button type="button" className="btn btn-primary btn-small" onClick={handleCreate} disabled={isSaving}>
            {isSaving ? 'Guardando…' : 'Crear periodo'}
          </button>
        </div>
      )}

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
  );
}

function FxRatesSection() {
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
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Tasas de cambio
          <HelpTooltip text="Cada moneda extranjera necesita al menos una tasa registrada para poder convertirla — sin eso, cualquier cobro, pago o reporte en esa moneda se rechaza en vez de inventar un número. Una operación ya registrada NUNCA se recalcula si registras una tasa nueva después: siempre conserva la que estaba vigente en su momento." />
        </h2>
      </div>

      {canManage && (
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
            <button type="submit" className="btn btn-primary btn-small" disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Guardar tasa'}
            </button>
          </div>
        </form>
      )}

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
  );
}

// Navegación secundaria interna (piloto de navegación, 2026-10-06): en
// vez de apilar las dos secciones una debajo de la otra en una sola
// pantalla larga, Configuración gana sus propias "sub-pestañas" —
// misma clase `.module-tab` ya usada en otras pantallas para un
// selector de modo (ej. Entrada/Salida/Ajuste en Inventario), sin
// inventar un componente nuevo ni una ruta nueva: sigue siendo
// /contabilidad/configuracion, un solo lugar, menos peso visible a la
// vez. Ninguna lógica de PeriodsSection/FxRatesSection cambió.
const SECTIONS = [
  { key: 'periods', label: 'Periodos' },
  { key: 'fx', label: 'Tasas de cambio' },
];

export default function ConfiguracionPage() {
  const [activeSection, setActiveSection] = useState('periods');

  return (
    <div className="page">
      <div className="module-tabs" style={{ marginBottom: 16 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`module-tab${activeSection === s.key ? ' is-active' : ''}`}
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {activeSection === 'periods' && <PeriodsSection />}
      {activeSection === 'fx' && <FxRatesSection />}
    </div>
  );
}
