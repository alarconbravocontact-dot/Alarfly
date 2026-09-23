import { useCallback, useEffect, useState } from 'react';
import { fiscalObligationsApi, taxRatesApi } from '../../api/fiscal';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import DueDateStatus from '../../core/ui/DueDateStatus';
import EmptyState from '../../core/ui/EmptyState';

const RECURRENCE_LABELS = { MONTHLY: 'Mensual', BIMONTHLY: 'Bimestral', ANNUAL: 'Anual' };
const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function emptyForm() {
  return { jurisdictionId: '', name: '', description: '', recurrence: 'MONTHLY', dueDayOfMonth: '', dueMonth: '' };
}

export default function FiscalObligationsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN';

  const [obligations, setObligations] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [warningThresholdDays, setWarningThresholdDays] = useState(7);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [obligationsData, jurisdictionsData] = await Promise.all([fiscalObligationsApi.list(), taxRatesApi.listJurisdictions()]);
      setObligations(obligationsData);
      setJurisdictions(jurisdictionsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las obligaciones fiscales.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    accountApi
      .getCompanyProfile()
      .then((c) => setWarningThresholdDays(c.dueDateWarningThresholdDays ?? 7))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function jurisdictionName(id) {
    return jurisdictions.find((j) => j.id === id)?.name || '—';
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    try {
      await fiscalObligationsApi.create({
        ...form,
        description: form.description || undefined,
        dueDayOfMonth: Number(form.dueDayOfMonth),
        dueMonth: form.recurrence === 'MONTHLY' ? undefined : Number(form.dueMonth),
      });
      setForm(emptyForm());
      setIsFormOpen(false);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la obligación fiscal.');
    }
  }

  async function handleToggleActive(obligation) {
    if (obligation.isActive) {
      const ok = await confirm({
        title: 'Desactivar obligación fiscal',
        message: `Vas a desactivar "${obligation.name}". Dejará de avisarte sobre su vencimiento.`,
        confirmLabel: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await fiscalObligationsApi.update(obligation.id, { isActive: !obligation.isActive });
      await loadAll();
    } catch {
      // se refleja al recargar
    }
  }

  async function handleScan() {
    setIsScanning(true);
    setScanMessage('');
    try {
      const result = await fiscalObligationsApi.scan();
      setScanMessage(`Se generaron ${result.totalCreated} alerta(s) nueva(s) de vencimiento.`);
    } catch (err) {
      setScanMessage(err instanceof ApiError ? err.message : 'No se pudo escanear el calendario fiscal.');
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Calendario fiscal
            <HelpTooltip text="Las obligaciones periódicas que tu empresa debe cumplir (declarar IVA, presentar retenciones, etc.). El sistema calcula solo la próxima fecha de vencimiento y puede avisarte con anticipación." />
          </h2>
          <div className="btn-row">
            <button type="button" className="btn btn-small" onClick={handleScan} disabled={isScanning}>
              {isScanning ? 'Escaneando…' : 'Escanear vencimientos'}
            </button>
            {canManage && (
              <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
                {isFormOpen ? 'Cancelar' : '+ Nueva obligación'}
              </button>
            )}
          </div>
        </div>
        {scanMessage && <p className="alert-box alert-box-success" style={{ marginBottom: 16 }}>{scanMessage}</p>}

        {isFormOpen && (
          <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>Jurisdicción</span>
              <select value={form.jurisdictionId} onChange={(e) => setForm({ ...form, jurisdictionId: e.target.value })} required>
                <option value="">Selecciona una jurisdicción</option>
                {jurisdictions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Nombre</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Declaración de IVA" required />
            </label>
            <label className="field">
              <span>Recurrencia</span>
              <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
                <option value="MONTHLY">Mensual</option>
                <option value="BIMONTHLY">Bimestral</option>
                <option value="ANNUAL">Anual</option>
              </select>
            </label>
            <label className="field">
              <span>Día del mes de vencimiento</span>
              <input type="number" min="1" max="31" value={form.dueDayOfMonth} onChange={(e) => setForm({ ...form, dueDayOfMonth: e.target.value })} required />
            </label>
            {form.recurrence !== 'MONTHLY' && (
              <label className="field">
                <span className="field-label">
                  Mes de referencia
                  <HelpTooltip text="Para una obligación bimestral, este mes (y los que le siguen cada 2 meses) es cuando vence. Para una anual, es simplemente el mes en que vence cada año." />
                </span>
                <select value={form.dueMonth} onChange={(e) => setForm({ ...form, dueMonth: e.target.value })} required>
                  <option value="">Selecciona un mes</option>
                  {MONTH_LABELS.map((label, i) => (
                    <option key={label} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field" style={{ gridColumn: 'span 2' }}>
              <span>Descripción (opcional)</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            {formError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary btn-small">
                Crear obligación
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && obligations.length === 0 && (
          <EmptyState icon="◷" message="Todavía no registraste ninguna obligación fiscal." />
        )}
        {!isLoading && !loadError && obligations.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Jurisdicción</th>
                <th>Recurrencia</th>
                <th>Próximo vencimiento</th>
                <th>Estado</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {obligations.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.name}
                    {o.description && <div className="text-muted">{o.description}</div>}
                  </td>
                  <td>{jurisdictionName(o.jurisdictionId)}</td>
                  <td>{RECURRENCE_LABELS[o.recurrence] || o.recurrence}</td>
                  <td>
                    {formatDate(new Date(o.nextDueDate))}
                    {o.isActive && (
                      <div style={{ marginTop: 4 }}>
                        <DueDateStatus dueDate={o.nextDueDate} thresholdDays={warningThresholdDays} />
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusSeal status={o.isActive ? 'active' : 'inactive'} label={o.isActive ? 'Activa' : 'Inactiva'} />
                  </td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => handleToggleActive(o)}>
                        {o.isActive ? 'Desactivar' : 'Activar'}
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
