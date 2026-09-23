import { useCallback, useEffect, useState } from 'react';
import { fiscalRiskRulesApi } from '../../api/fiscal';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const SEVERITY_LABELS = { WARNING: 'Advertencia (deja pasar)', BLOCKING: 'Bloqueante (impide guardar)' };
const SEVERITY_TONE = { WARNING: 'warning', BLOCKING: 'negative' };

function emptyForm() {
  return { name: '', description: '', severity: 'WARNING', condition: '{\n  "field": "taxBase",\n  "op": "gt",\n  "value": 5000\n}' };
}

export default function RiskRulesPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN';

  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setRules(await fiscalRiskRulesApi.list());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las reglas de riesgo.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    let condition;
    try {
      condition = JSON.parse(form.condition);
    } catch {
      setFormError('La condición debe ser un JSON válido.');
      return;
    }
    try {
      await fiscalRiskRulesApi.create({ name: form.name, description: form.description || undefined, severity: form.severity, condition });
      setForm(emptyForm());
      setIsFormOpen(false);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la regla.');
    }
  }

  async function handleToggleActive(rule) {
    if (rule.isActive) {
      const ok = await confirm({
        title: 'Desactivar regla de riesgo',
        message: `Vas a desactivar la regla "${rule.name}". Dejará de evaluarse en nuevas transacciones fiscales.`,
        confirmLabel: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await fiscalRiskRulesApi.update(rule.id, { isActive: !rule.isActive });
      await loadAll();
    } catch {
      // se refleja al recargar
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Reglas de validación fiscal
            <HelpTooltip text="Revisan cada venta o compra fiscal antes de guardarla. Una regla “advertencia” deja pasar la transacción pero avisa; una regla “bloqueante” impide guardarla hasta corregir el problema." />
          </h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nueva regla'}
            </button>
          )}
        </div>

        {isFormOpen && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label className="field">
                <span>Severidad</span>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  <option value="WARNING">Advertencia (deja pasar)</option>
                  <option value="BLOCKING">Bloqueante (impide guardar)</option>
                </select>
              </label>
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span>Descripción (opcional)</span>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
            <label className="field" style={{ marginTop: 12 }}>
              <span className="field-label">
                Condición
                <HelpTooltip text="Cuándo se activa la regla, escrita en un formato de texto llamado JSON. Los datos disponibles son: type (VENTA/COMPRA), taxBase (base gravable), taxAmount (impuesto), withholdingAmount (retención), counterpartyTaxId (NIT/RFC), hasWithholding (si tiene retención). Ejemplo: {“field”: “taxBase”, “op”: “gt”, “value”: 5000} se activa si la base gravable supera 5000. Para combinar varias condiciones, usa {“all”: [...]} (todas deben cumplirse) o {“any”: [...]} (alguna debe cumplirse)." />
              </span>
              <textarea rows={5} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} style={{ fontFamily: 'monospace' }} />
            </label>
            {formError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary">
                Crear regla
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && rules.length === 0 && (
          <EmptyState icon="⚑" message="Todavía no creaste ninguna regla de validación fiscal." />
        )}
        {!isLoading && !loadError && rules.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Severidad</th>
                <th>Estado</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    {rule.name}
                    {rule.description && <div className="text-muted">{rule.description}</div>}
                  </td>
                  <td>
                    <StatusSeal tone={SEVERITY_TONE[rule.severity]} label={SEVERITY_LABELS[rule.severity] || rule.severity} />
                  </td>
                  <td>
                    <StatusSeal status={rule.isActive ? 'active' : 'inactive'} label={rule.isActive ? 'Activa' : 'Inactiva'} />
                  </td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => handleToggleActive(rule)}>
                        {rule.isActive ? 'Desactivar' : 'Activar'}
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
