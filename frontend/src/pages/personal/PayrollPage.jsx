import { Fragment, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { payrollApi, employeesApi, personalTreasuryAccountsApi } from '../../api/personal';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import FormField, { RequiredFieldsNote } from '../../core/ui/FormField';

const STATUS_LABELS = { DRAFT: 'Borrador', CALCULATED: 'Calculada', REVIEWED: 'Revisada', APPROVED: 'Aprobada', PAID: 'Pagada' };
const STATUS_TONE = { DRAFT: 'warning', CALCULATED: 'warning', REVIEWED: 'warning', APPROVED: 'warning', PAID: 'active' };

const EMPTY_FORM = { label: '', startDate: '', endDate: '', paymentDate: '', currency: 'USD' };

export default function PayrollPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [payrolls, setPayrolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (location.state?.autoOpenCreate) {
      setIsFormOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const loadPayrolls = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setPayrolls(await payrollApi.list());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las nóminas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayrolls();
  }, [loadPayrolls]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      const created = await payrollApi.create(form);
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadPayrolls();
      setSelectedId(created.id);
      showToast({ message: `Nómina "${created.label}" creada. Selecciona los empleados y calcula.` });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la nómina.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">Nómina</h2>
        <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? 'Cancelar' : '+ Nueva nómina'}
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleCreate} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
          <div className="form-grid">
            <FormField label="Período" required help="Ej. «Enero 2026» — como quieras identificar esta nómina.">
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </FormField>
            <FormField label="Fecha de inicio" required>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </FormField>
            <FormField label="Fecha de fin" required>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </FormField>
            <FormField label="Fecha de pago" required>
              <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
            </FormField>
            <FormField label="Moneda" required>
              <input value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </FormField>
          </div>
          <RequiredFieldsNote />
          {formError && (
            <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
              {formError}
            </p>
          )}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Crear nómina'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-muted">Cargando…</p>}
      {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
      {!isLoading && !loadError && payrolls.length === 0 && (
        <EmptyState icon="●" message="Todavía no creaste ninguna nómina." actionLabel="+ Nueva nómina" onAction={() => setIsFormOpen(true)} />
      )}
      {!isLoading && !loadError && payrolls.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Período</th>
              <th>Fecha de pago</th>
              <th>Empleados</th>
              <th className="num">Neto a pagar</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payrolls.map((payroll) => (
              <tr key={payroll.id}>
                <td>
                  <button type="button" className="record-link" onClick={() => setSelectedId(payroll.id)}>
                    {payroll.label}
                  </button>
                </td>
                <td>{formatDate(new Date(payroll.paymentDate))}</td>
                <td>{payroll._count?.items ?? '—'}</td>
                <td className="num">{formatCurrency(payroll.netTotal, payroll.currency)}</td>
                <td>
                  <StatusSeal tone={STATUS_TONE[payroll.status]} label={STATUS_LABELS[payroll.status]} />
                </td>
                <td>
                  <button type="button" className="btn btn-small" onClick={() => setSelectedId(payroll.id)}>
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedId && (
        <PayrollDetail
          payrollId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={loadPayrolls}
          confirm={confirm}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function BreakdownEditor({ label, rows, onChange }) {
  function updateRow(index, field, value) {
    const next = rows.slice();
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  }
  function addRow() {
    onChange([...rows, { label: '', amount: '' }]);
  }
  function removeRow(index) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 4 }}>
        {label}
      </p>
      {rows.map((row, index) => (
        <div className="btn-row" key={index} style={{ marginBottom: 4 }}>
          <input placeholder="Concepto" value={row.label} onChange={(e) => updateRow(index, 'label', e.target.value)} style={{ flex: 2 }} />
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Monto"
            value={row.amount}
            onChange={(e) => updateRow(index, 'amount', e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-small btn-danger" onClick={() => removeRow(index)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-small" onClick={addRow}>
        + Agregar concepto
      </button>
    </div>
  );
}

function PayrollDetail({ payrollId, onClose, onChanged, confirm, showToast }) {
  const [payroll, setPayroll] = useState(null);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState([]);
  const [treasuryAccountId, setTreasuryAccountId] = useState('');
  const [editing, setEditing] = useState({}); // itemId -> {incomeBreakdown, deductionBreakdown}
  const [isWorking, setIsWorking] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await payrollApi.getOne(payrollId);
      setPayroll(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la nómina.');
    }
  }, [payrollId]);

  useEffect(() => {
    load();
    employeesApi.list({ status: 'ACTIVE' }).then(setEmployees).catch(() => {});
    personalTreasuryAccountsApi.list().then(setTreasuryAccounts).catch(() => {});
  }, [load]);

  async function runAction(action, successMessage) {
    setIsWorking(true);
    setError('');
    try {
      await action();
      await load();
      await onChanged();
      if (successMessage) showToast({ message: successMessage });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCalculate() {
    if (selectedEmployeeIds.length === 0) {
      setError('Selecciona al menos un empleado.');
      return;
    }
    await runAction(() => payrollApi.calculate(payrollId, selectedEmployeeIds), 'Nómina calculada.');
  }

  function startEditing(item) {
    setEditing({ ...editing, [item.id]: { incomeBreakdown: item.incomeBreakdown || [], deductionBreakdown: item.deductionBreakdown || [] } });
  }

  async function saveItem(itemId) {
    const draft = editing[itemId];
    const clean = (rows) => rows.filter((r) => r.label && r.amount !== '').map((r) => ({ label: r.label, amount: Number(r.amount) }));
    await runAction(
      () => payrollApi.updateItem(payrollId, itemId, { incomeBreakdown: clean(draft.incomeBreakdown), deductionBreakdown: clean(draft.deductionBreakdown) }),
      'Línea actualizada.'
    );
    setEditing((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  async function handlePay() {
    if (!treasuryAccountId) {
      setError('Selecciona con qué cuenta se paga.');
      return;
    }
    const confirmed = await confirm({
      title: 'Pagar nómina',
      message: `Se creará una orden de pago en Tesorería por cada empleado, por el total de ${formatCurrency(payroll.netTotal, payroll.currency)}. El pago final sigue el flujo de aprobación de Tesorería.`,
      confirmLabel: 'Pagar',
    });
    if (!confirmed) return;
    await runAction(() => payrollApi.pay(payrollId, treasuryAccountId), 'Nómina marcada como pagada. Revisa Tesorería > Órdenes de Pago.');
  }

  if (error && !payroll) return <p className="alert-box alert-box-error">{error}</p>;
  if (!payroll) return <p className="text-muted">Cargando…</p>;

  const isEditable = payroll.status === 'DRAFT' || payroll.status === 'CALCULATED';

  return (
    <div className="panel" style={{ marginTop: 20, borderTop: '2px solid var(--color-border)' }}>
      <div className="panel-header">
        <h3 className="field-label">
          {payroll.label}
          <HelpTooltip text="Borrador → Calculada → Revisada → Aprobada → Pagada. Una vez revisada, los montos quedan fijos; una vez pagada, la nómina ya no se puede editar." />
        </h3>
        <div className="btn-row">
          <StatusSeal tone={STATUS_TONE[payroll.status]} label={STATUS_LABELS[payroll.status]} />
          <button type="button" className="btn btn-small" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

      {error && <p className="alert-box alert-box-error">{error}</p>}

      {payroll.status === 'DRAFT' && (
        <div style={{ marginBottom: 16 }}>
          <p className="text-muted" style={{ marginBottom: 8 }}>
            Selecciona los empleados activos a incluir:
          </p>
          <div className="form-grid">
            {employees.map((employee) => (
              <label key={employee.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedEmployeeIds.includes(employee.id)}
                  onChange={(e) =>
                    setSelectedEmployeeIds((prev) => (e.target.checked ? [...prev, employee.id] : prev.filter((id) => id !== employee.id)))
                  }
                />
                {employee.firstName} {employee.lastName} — {formatCurrency(employee.baseSalary, employee.currency)}
              </label>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-small" style={{ marginTop: 8 }} onClick={handleCalculate} disabled={isWorking}>
            Calcular nómina
          </button>
        </div>
      )}

      {payroll.items.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th className="num">Salario base</th>
              <th className="num">Total ingresos</th>
              <th className="num">Deducciones</th>
              <th className="num">Neto</th>
              {isEditable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {payroll.items.map((item) => (
              <Fragment key={item.id}>
                <tr>
                  <td>
                    {item.employee.firstName} {item.employee.lastName}
                  </td>
                  <td className="num">{formatCurrency(item.baseSalary, payroll.currency)}</td>
                  <td className="num">{formatCurrency(item.totalIncome, payroll.currency)}</td>
                  <td className="num">{formatCurrency(item.totalDeductions, payroll.currency)}</td>
                  <td className="num">{formatCurrency(item.netPay, payroll.currency)}</td>
                  {isEditable && (
                    <td>
                      {!editing[item.id] && (
                        <button type="button" className="btn btn-small" onClick={() => startEditing(item)}>
                          Editar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                {editing[item.id] && (
                  <tr>
                    <td colSpan={6}>
                      <div className="form-grid">
                        <BreakdownEditor
                          label="Otros ingresos"
                          rows={editing[item.id].incomeBreakdown}
                          onChange={(rows) => setEditing({ ...editing, [item.id]: { ...editing[item.id], incomeBreakdown: rows } })}
                        />
                        <BreakdownEditor
                          label="Deducciones"
                          rows={editing[item.id].deductionBreakdown}
                          onChange={(rows) => setEditing({ ...editing, [item.id]: { ...editing[item.id], deductionBreakdown: rows } })}
                        />
                      </div>
                      <div className="btn-row" style={{ marginTop: 8 }}>
                        <button type="button" className="btn btn-primary btn-small" onClick={() => saveItem(item.id)} disabled={isWorking}>
                          Guardar
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() =>
                            setEditing((prev) => {
                              const next = { ...prev };
                              delete next[item.id];
                              return next;
                            })
                          }
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>
                Total
              </td>
              <td className="num" style={{ fontWeight: 600 }}>
                {formatCurrency(payroll.netTotal, payroll.currency)}
              </td>
              {isEditable && <td></td>}
            </tr>
          </tfoot>
        </table>
      )}

      <div className="btn-row" style={{ marginTop: 16 }}>
        {payroll.status === 'CALCULATED' && (
          <button type="button" className="btn btn-primary btn-small" onClick={() => runAction(() => payrollApi.review(payrollId), 'Nómina revisada.')} disabled={isWorking}>
            Marcar como revisada
          </button>
        )}
        {payroll.status === 'CALCULATED' && (
          <button type="button" className="btn btn-small" onClick={() => runAction(() => payrollApi.sendBackToDraft(payrollId))} disabled={isWorking}>
            Devolver a borrador
          </button>
        )}
        {payroll.status === 'REVIEWED' && (
          <button type="button" className="btn btn-primary btn-small" onClick={() => runAction(() => payrollApi.approve(payrollId), 'Nómina aprobada — se posteó el asiento de obligación.')} disabled={isWorking}>
            Aprobar
          </button>
        )}
        {payroll.status === 'REVIEWED' && (
          <button type="button" className="btn btn-small" onClick={() => runAction(() => payrollApi.sendBackToCalculated(payrollId))} disabled={isWorking}>
            Devolver a calculada
          </button>
        )}
        {payroll.status === 'APPROVED' && (
          <>
            <select value={treasuryAccountId} onChange={(e) => setTreasuryAccountId(e.target.value)}>
              <option value="">Pagar con…</option>
              {treasuryAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-small" onClick={handlePay} disabled={isWorking}>
              Registrar pago
            </button>
          </>
        )}
        {payroll.status === 'PAID' && <p className="text-muted">Esta nómina ya fue pagada y no se puede editar.</p>}
      </div>
    </div>
  );
}
