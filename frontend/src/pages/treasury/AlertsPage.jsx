import { useCallback, useEffect, useState } from 'react';
import { treasuryAlertsApi } from '../../api/treasury';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const ALERT_TYPES = [
  { value: 'LOW_BALANCE', label: 'Saldo bajo en cuenta' },
  { value: 'CREDIT_CARD_NEAR_LIMIT', label: 'Tarjeta cerca del límite' },
  { value: 'PAYMENT_DUE_SOON', label: 'Pago próximo a vencer' },
  { value: 'FISCAL_OBLIGATION_DUE', label: 'Obligación fiscal próxima' },
  { value: 'CUSTOMER_RECURRING_LATE_PAYMENT', label: 'Cliente con atraso recurrente' },
  { value: 'LOW_STOCK', label: 'Stock bajo' },
  { value: 'PRODUCT_EXPIRING_SOON', label: 'Producto por vencer' },
  { value: 'AR_COLLECTION_ESCALATION', label: 'Cobranza escalonada de AR' },
];
const TYPE_LABELS = Object.fromEntries(ALERT_TYPES.map((t) => [t.value, t.label]));
const SEVERITY_SEAL_TONE = { CRITICAL: 'negative', WARNING: 'warning', INFO: 'neutral' };
const SEVERITY_LABELS = { CRITICAL: 'Crítica', WARNING: 'Advertencia', INFO: 'Informativa' };

export default function AlertsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'ADMIN';

  const [rules, setRules] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ type: 'LOW_BALANCE', name: '', parameters: '{}' });
  const [ruleError, setRuleError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [actionError, setActionError] = useState({});

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [rulesData, alertsData] = await Promise.all([treasuryAlertsApi.listRules(), treasuryAlertsApi.list({})]);
      setRules(rulesData);
      setAlerts(alertsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar las alertas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreateRule(event) {
    event.preventDefault();
    setRuleError('');
    let parameters;
    try {
      parameters = JSON.parse(ruleForm.parameters || '{}');
    } catch {
      setRuleError('Los parámetros deben ser un JSON válido, ej: {}');
      return;
    }
    try {
      await treasuryAlertsApi.createRule({ type: ruleForm.type, name: ruleForm.name, parameters });
      setRuleForm({ type: 'LOW_BALANCE', name: '', parameters: '{}' });
      setIsRuleFormOpen(false);
      await loadAll();
    } catch (err) {
      setRuleError(err instanceof ApiError ? err.message : 'No se pudo crear la regla.');
    }
  }

  async function handleDeactivateRule(rule) {
    const ok = await confirm({
      title: 'Desactivar regla de alerta',
      message: `Vas a desactivar la regla "${rule.name}". Dejará de generar alertas nuevas.`,
      confirmLabel: 'Desactivar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await treasuryAlertsApi.deactivateRule(rule.id);
      await loadAll();
    } catch {
      // se refleja al recargar
    }
  }

  async function handleScan() {
    setIsScanning(true);
    setScanMessage('');
    try {
      const result = await treasuryAlertsApi.scan();
      setScanMessage(`Se generaron ${Array.isArray(result) ? result.length : result.created ?? 0} alerta(s) nueva(s).`);
      await loadAll();
    } catch (err) {
      setScanMessage(err instanceof ApiError ? err.message : 'No se pudo escanear.');
    } finally {
      setIsScanning(false);
    }
  }

  async function handleAcknowledge(alert) {
    setActionError((prev) => ({ ...prev, [alert.id]: '' }));
    try {
      await treasuryAlertsApi.acknowledge(alert.id);
      await loadAll();
    } catch (err) {
      setActionError((prev) => ({ ...prev, [alert.id]: err instanceof ApiError ? err.message : 'No se pudo confirmar la alerta.' }));
    }
  }

  return (
    <div className="page">
      {isAdmin && (
        <div className="panel">
          <div className="panel-header">
            <h2>Reglas de alerta</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsRuleFormOpen((v) => !v)}>
              {isRuleFormOpen ? 'Cancelar' : '+ Nueva regla'}
            </button>
          </div>
          {isRuleFormOpen && (
            <form onSubmit={handleCreateRule} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
              <div className="form-grid">
                <label className="field">
                  <span>Tipo de alerta</span>
                  <select value={ruleForm.type} onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value })}>
                    {ALERT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Nombre</span>
                  <input value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} required />
                </label>
              </div>
              <label className="field" style={{ marginTop: 12 }}>
                <span className="field-label">
                  Parámetros
                  <HelpTooltip text="Ajustes finos de esta alerta, escritos en un formato de texto llamado JSON — por ejemplo {“daysBefore”: 5} para avisar 5 días antes de un vencimiento. Si no necesitas ajustar nada especial, déjalo como {} (llaves vacías)." />
                </span>
                <textarea rows={3} value={ruleForm.parameters} onChange={(e) => setRuleForm({ ...ruleForm, parameters: e.target.value })} />
              </label>
              {ruleError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{ruleError}</p>}
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="submit" className="btn btn-primary">
                  Crear regla
                </button>
              </div>
            </form>
          )}

          {rules.length === 0 && <EmptyState icon="▲" message="Todavía no creaste ninguna regla de alerta." />}
          {rules.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{TYPE_LABELS[r.type] || r.type}</td>
                    <td>
                      <StatusSeal status={r.isActive ? 'active' : 'inactive'} label={r.isActive ? 'Activa' : 'Inactiva'} />
                    </td>
                    <td>
                      {r.isActive && (
                        <button type="button" className="btn btn-small btn-danger" onClick={() => handleDeactivateRule(r)}>
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Alertas</h2>
          {isAdmin && (
            <button type="button" className="btn btn-small" onClick={handleScan} disabled={isScanning}>
              {isScanning ? 'Escaneando…' : 'Escanear ahora'}
            </button>
          )}
        </div>
        {scanMessage && <p className="alert-box alert-box-success" style={{ marginBottom: 12 }}>{scanMessage}</p>}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && alerts.length === 0 && <EmptyState icon="○" message="No hay alertas activas por ahora." />}
        {!isLoading && !loadError && alerts.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Severidad</th>
                <th>Mensaje</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(new Date(a.createdAt))}</td>
                  <td>{TYPE_LABELS[a.type] || a.type}</td>
                  <td>
                    <StatusSeal tone={SEVERITY_SEAL_TONE[a.severity] || 'neutral'} label={SEVERITY_LABELS[a.severity] || a.severity} />
                  </td>
                  <td>{a.message}</td>
                  <td>
                    <StatusSeal
                      status={a.status === 'ACKNOWLEDGED' ? 'active' : 'pending'}
                      label={a.status === 'ACKNOWLEDGED' ? 'Atendida' : 'Activa'}
                    />
                  </td>
                  <td>
                    {a.status === 'ACTIVE' && (
                      <button type="button" className="btn btn-small" onClick={() => handleAcknowledge(a)}>
                        Marcar como atendida
                      </button>
                    )}
                    {actionError[a.id] && <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>{actionError[a.id]}</p>}
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
