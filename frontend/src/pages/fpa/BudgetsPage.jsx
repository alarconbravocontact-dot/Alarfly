import { useCallback, useEffect, useState } from 'react';
import { budgetsApi, fpaDimensionsApi } from '../../api/fpa';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatCurrency } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const STATUS_LABELS = { DRAFT: 'Borrador', IN_REVIEW: 'En revisión', APPROVED: 'Aprobado' };
const STATUS_SEAL_TONE = { DRAFT: 'neutral', IN_REVIEW: 'warning', APPROVED: 'positive' };

const EMPTY_LINE_FORM = {
  accountId: '',
  fpaDimensionId: '',
  period: 1,
  amountType: 'FIXED',
  amount: '',
  formula: '',
  notes: '',
};

export default function BudgetsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const canApprove = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [budgets, setBudgets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [dimensions, setDimensions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [detailError, setDetailError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', fiscalYear: new Date().getFullYear(), versionType: 'ORIGINAL', previousVersionId: '' });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [lineForm, setLineForm] = useState(EMPTY_LINE_FORM);
  const [lineError, setLineError] = useState('');
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [budgetsData, accountsData, dimensionsData] = await Promise.all([
        budgetsApi.list(),
        accountsApi.list({ isActive: true }),
        fpaDimensionsApi.list({ isActive: true }),
      ]);
      setBudgets(budgetsData);
      setAccounts(accountsData.filter((a) => a.isPostable));
      setDimensions(dimensionsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los presupuestos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadDetail = useCallback(async (id) => {
    setDetailError('');
    try {
      const data = await budgetsApi.getOne(id);
      setSelectedBudget(data);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'No se pudo cargar el detalle del presupuesto.');
    }
  }, []);

  function selectBudget(budget) {
    setSelectedId(budget.id);
    setActionError('');
    setLineError('');
    loadDetail(budget.id);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      const created = await budgetsApi.create({
        name: form.name,
        fiscalYear: Number(form.fiscalYear),
        versionType: form.versionType,
        previousVersionId: form.versionType === 'REFORECAST' ? form.previousVersionId : undefined,
      });
      setForm({ name: '', fiscalYear: new Date().getFullYear(), versionType: 'ORIGINAL', previousVersionId: '' });
      setIsFormOpen(false);
      await loadAll();
      selectBudget(created);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el presupuesto.');
    } finally {
      setIsSaving(false);
    }
  }

  async function runTransition(action) {
    if (!selectedBudget) return;
    setActionError('');
    try {
      if (action === 'submit') await budgetsApi.submitForReview(selectedBudget.id);
      if (action === 'sendBack') await budgetsApi.sendBackToDraft(selectedBudget.id);
      if (action === 'approve') await budgetsApi.approve(selectedBudget.id);
      await loadAll();
      await loadDetail(selectedBudget.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
    }
  }

  async function handleAddLine(event) {
    event.preventDefault();
    setLineError('');
    setIsSavingLine(true);
    try {
      await budgetsApi.upsertLine(selectedBudget.id, {
        accountId: lineForm.accountId,
        fpaDimensionId: lineForm.fpaDimensionId,
        period: Number(lineForm.period),
        amountType: lineForm.amountType,
        amount: lineForm.amountType === 'FIXED' ? Number(lineForm.amount) : undefined,
        formula: lineForm.amountType === 'FORMULA' ? lineForm.formula : undefined,
        notes: lineForm.notes || undefined,
      });
      setLineForm(EMPTY_LINE_FORM);
      await loadDetail(selectedBudget.id);
    } catch (err) {
      setLineError(err instanceof ApiError ? err.message : 'No se pudo agregar la línea.');
    } finally {
      setIsSavingLine(false);
    }
  }

  async function handleDeleteLine(line) {
    const ok = await confirm({
      title: 'Eliminar línea de presupuesto',
      message: `Vas a eliminar la línea de "${line.account.code} · ${line.account.name}" del mes ${line.period}. Esto no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    setActionError('');
    try {
      await budgetsApi.deleteLine(selectedBudget.id, line.id);
      await loadDetail(selectedBudget.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo eliminar la línea.');
    }
  }

  const sameYearBudgets = budgets.filter((b) => b.fiscalYear === Number(form.fiscalYear));

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2>Presupuestos</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nuevo presupuesto'}
            </button>
          </div>

          {isFormOpen && (
            <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 12 }}>
              <label className="field">
                <span>Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Presupuesto 2026" required />
              </label>
              <label className="field">
                <span>Año fiscal</span>
                <input
                  type="number"
                  value={form.fiscalYear}
                  onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">
                  Versión
                  <HelpTooltip text="Original: el primer presupuesto del año. Reforecast: una revisión posterior que parte copiando las líneas de una versión ya existente, para ajustar solo lo que cambió." />
                </span>
                <select value={form.versionType} onChange={(e) => setForm({ ...form, versionType: e.target.value })}>
                  <option value="ORIGINAL">Original</option>
                  <option value="REFORECAST">Reforecast</option>
                </select>
              </label>
              {form.versionType === 'REFORECAST' && (
                <label className="field">
                  <span>Parte de</span>
                  <select
                    value={form.previousVersionId}
                    onChange={(e) => setForm({ ...form, previousVersionId: e.target.value })}
                    required
                  >
                    <option value="">Selecciona una versión</option>
                    {sameYearBudgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (v{b.versionNumber})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {formError && (
                <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                  {formError}
                </p>
              )}
              <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Guardando…' : 'Crear presupuesto'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="panel">
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && budgets.length === 0 && (
          <EmptyState icon="▲" message="Todavía no creaste ningún presupuesto." />
        )}
        {!isLoading && !loadError && budgets.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Año fiscal</th>
                <th>Versión</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id} style={{ background: selectedId === b.id ? 'var(--color-surface-hover)' : undefined }}>
                  <td>{b.name}</td>
                  <td>{b.fiscalYear}</td>
                  <td>
                    {b.versionType === 'ORIGINAL' ? 'Original' : 'Reforecast'} (v{b.versionNumber})
                  </td>
                  <td>
                    <StatusSeal tone={STATUS_SEAL_TONE[b.status]} label={STATUS_LABELS[b.status]} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => selectBudget(b)}>
                      {selectedId === b.id ? 'Seleccionado' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedBudget && (
        <div className="panel">
          <div className="panel-header">
            <h2>
              {selectedBudget.name} — {selectedBudget.fiscalYear}
            </h2>
            <div className="btn-row">
              <StatusSeal tone={STATUS_SEAL_TONE[selectedBudget.status]} label={STATUS_LABELS[selectedBudget.status]} />
              {canManage && selectedBudget.status === 'DRAFT' && (
                <button type="button" className="btn btn-small btn-primary" onClick={() => runTransition('submit')}>
                  Enviar a revisión
                </button>
              )}
              {canManage && selectedBudget.status === 'IN_REVIEW' && (
                <button type="button" className="btn btn-small" onClick={() => runTransition('sendBack')}>
                  Devolver a borrador
                </button>
              )}
              {canApprove && selectedBudget.status === 'IN_REVIEW' && (
                <button type="button" className="btn btn-small btn-primary" onClick={() => runTransition('approve')}>
                  Aprobar
                </button>
              )}
            </div>
          </div>

          {detailError && <p className="alert-box alert-box-error">{detailError}</p>}
          {actionError && <p className="alert-box alert-box-error">{actionError}</p>}

          {canManage && selectedBudget.status === 'DRAFT' && (
            <form onSubmit={handleAddLine} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
              <div className="form-grid">
                <label className="field">
                  <span>Cuenta</span>
                  <select value={lineForm.accountId} onChange={(e) => setLineForm({ ...lineForm, accountId: e.target.value })} required>
                    <option value="">Selecciona una cuenta</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Dimensión</span>
                  <select
                    value={lineForm.fpaDimensionId}
                    onChange={(e) => setLineForm({ ...lineForm, fpaDimensionId: e.target.value })}
                    required
                  >
                    <option value="">Selecciona una dimensión</option>
                    {dimensions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Mes (1-12)</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={lineForm.period}
                    onChange={(e) => setLineForm({ ...lineForm, period: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">
                    Tipo de monto
                    <HelpTooltip text="Fijo: escribes el monto presupuestado directamente. Fórmula: el monto se calcula a partir de otras líneas de monto fijo de este mismo presupuesto (ej. [4135_1] * 1.05)." />
                  </span>
                  <select value={lineForm.amountType} onChange={(e) => setLineForm({ ...lineForm, amountType: e.target.value })}>
                    <option value="FIXED">Fijo</option>
                    <option value="FORMULA">Fórmula</option>
                  </select>
                </label>
                {lineForm.amountType === 'FIXED' ? (
                  <label className="field">
                    <span>Monto</span>
                    <input
                      type="number"
                      step="0.01"
                      value={lineForm.amount}
                      onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })}
                      required
                    />
                  </label>
                ) : (
                  <label className="field">
                    <span>Fórmula</span>
                    <input
                      value={lineForm.formula}
                      onChange={(e) => setLineForm({ ...lineForm, formula: e.target.value })}
                      placeholder="[4135_1] * 1.05"
                      required
                    />
                  </label>
                )}
                <label className="field">
                  <span>Notas (opcional)</span>
                  <input value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
                </label>
              </div>
              {lineError && (
                <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                  {lineError}
                </p>
              )}
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="submit" className="btn btn-primary btn-small" disabled={isSavingLine}>
                  {isSavingLine ? 'Guardando…' : '+ Agregar línea'}
                </button>
              </div>
            </form>
          )}

          {selectedBudget.lines.length === 0 && <EmptyState icon="○" message="Este presupuesto todavía no tiene líneas." />}
          {selectedBudget.lines.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Dimensión</th>
                  <th>Mes</th>
                  <th>Tipo</th>
                  <th className="num">Monto / Fórmula</th>
                  {canManage && selectedBudget.status === 'DRAFT' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {selectedBudget.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      {line.account.code} · {line.account.name}
                    </td>
                    <td>{line.fpaDimension.name}</td>
                    <td>{line.period}</td>
                    <td>{line.amountType === 'FIXED' ? 'Fijo' : 'Fórmula'}</td>
                    <td className="num">{line.amountType === 'FIXED' ? formatCurrency(line.amount) : line.formula}</td>
                    {canManage && selectedBudget.status === 'DRAFT' && (
                      <td>
                        <button type="button" className="btn btn-small btn-danger" onClick={() => handleDeleteLine(line)}>
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
      )}
    </div>
  );
}
