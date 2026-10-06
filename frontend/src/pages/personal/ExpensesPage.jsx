import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { employeeExpensesApi, employeesApi } from '../../api/personal';
import { personalTreasuryAccountsApi } from '../../api/personal';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import FormField, { RequiredFieldsNote } from '../../core/ui/FormField';

const CATEGORY_OPTIONS = ['transporte', 'alimentación', 'representación', 'compras menores', 'otros'];
const STATUS_LABELS = { PENDING_APPROVAL: 'En revisión', APPROVED: 'Aprobado', REJECTED: 'Rechazado', REIMBURSED: 'Reembolsado' };
const STATUS_TONE = { PENDING_APPROVAL: 'warning', APPROVED: 'warning', REJECTED: 'negative', REIMBURSED: 'positive' };

const EMPTY_FORM = { employeeId: '', expenseDate: '', category: CATEGORY_OPTIONS[0], description: '', amount: '', currency: 'USD' };

export default function ExpensesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [payingId, setPayingId] = useState(null);
  const [treasuryAccountId, setTreasuryAccountId] = useState('');
  const [rowErrors, setRowErrors] = useState({});

  useEffect(() => {
    if (location.state?.autoOpenCreate) {
      setIsFormOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [expenseList, employeeList, accountList] = await Promise.all([
        employeeExpensesApi.list(),
        employeesApi.list({ status: 'ACTIVE' }),
        personalTreasuryAccountsApi.list(),
      ]);
      setExpenses(expenseList);
      setEmployees(employeeList);
      setTreasuryAccounts(accountList);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los gastos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleRegister(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await employeeExpensesApi.register({ ...form, amount: Number(form.amount) });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadAll();
      showToast({ message: 'Gasto registrado — queda en revisión.' });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar el gasto.');
    } finally {
      setIsSaving(false);
    }
  }

  function setRowError(id, message) {
    setRowErrors((prev) => ({ ...prev, [id]: message }));
  }

  async function handleApprove(expense) {
    const confirmed = await confirm({
      title: 'Aprobar gasto',
      message: `Se reconocerá como obligación de la empresa ${formatCurrency(expense.amount, expense.currency)}. Podrás reembolsarlo después desde Tesorería.`,
      confirmLabel: 'Aprobar',
    });
    if (!confirmed) return;
    setRowError(expense.id, '');
    try {
      await employeeExpensesApi.decide(expense.id, 'APPROVED');
      await loadAll();
    } catch (err) {
      setRowError(expense.id, err instanceof ApiError ? err.message : 'No se pudo aprobar el gasto.');
    }
  }

  async function handleReject(expense) {
    if (!rejectionReason.trim()) {
      setRowError(expense.id, 'Debes indicar el motivo del rechazo.');
      return;
    }
    try {
      await employeeExpensesApi.decide(expense.id, 'REJECTED', rejectionReason);
      setRejectingId(null);
      setRejectionReason('');
      await loadAll();
    } catch (err) {
      setRowError(expense.id, err instanceof ApiError ? err.message : 'No se pudo rechazar el gasto.');
    }
  }

  async function handleReimburse(expense) {
    if (!treasuryAccountId) {
      setRowError(expense.id, 'Selecciona con qué cuenta se reembolsa.');
      return;
    }
    try {
      await employeeExpensesApi.reimburse(expense.id, treasuryAccountId);
      setPayingId(null);
      setTreasuryAccountId('');
      await loadAll();
      showToast({ message: 'Orden de reembolso creada — revísala en Tesorería > Órdenes de Pago.' });
    } catch (err) {
      setRowError(expense.id, err instanceof ApiError ? err.message : 'No se pudo reembolsar el gasto.');
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">Gastos de Personal</h2>
        <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? 'Cancelar' : '+ Registrar gasto'}
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleRegister} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
          <div className="form-grid">
            <FormField label="Empleado" required>
              <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Selecciona…</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Fecha" required>
              <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
            </FormField>
            <FormField label="Categoría">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Descripción" required>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <FormField label="Monto" required>
              <input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
              {isSaving ? 'Guardando…' : 'Registrar gasto'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-muted">Cargando…</p>}
      {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
      {!isLoading && !loadError && expenses.length === 0 && (
        <EmptyState icon="●" message="Todavía no hay gastos de personal registrados." actionLabel="+ Registrar gasto" onAction={() => setIsFormOpen(true)} />
      )}
      {!isLoading && !loadError && expenses.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Fecha</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th className="num">Monto</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>
                  {expense.employee.firstName} {expense.employee.lastName}
                </td>
                <td>{formatDate(new Date(expense.expenseDate))}</td>
                <td>{expense.category || '—'}</td>
                <td>{expense.description}</td>
                <td className="num">{formatCurrency(expense.amount, expense.currency)}</td>
                <td>
                  <StatusSeal tone={STATUS_TONE[expense.status]} label={STATUS_LABELS[expense.status]} />
                </td>
                <td>
                  {expense.status === 'PENDING_APPROVAL' && rejectingId !== expense.id && (
                    <div className="btn-row">
                      <button type="button" className="btn btn-small btn-primary" onClick={() => handleApprove(expense)}>
                        Aprobar
                      </button>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => setRejectingId(expense.id)}>
                        Rechazar
                      </button>
                    </div>
                  )}
                  {rejectingId === expense.id && (
                    <div className="btn-row">
                      <input placeholder="Motivo del rechazo" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                      <button type="button" className="btn btn-small btn-danger" onClick={() => handleReject(expense)}>
                        Confirmar
                      </button>
                      <button type="button" className="btn btn-small" onClick={() => setRejectingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                  {expense.status === 'APPROVED' && payingId !== expense.id && (
                    <button type="button" className="btn btn-small btn-primary" onClick={() => setPayingId(expense.id)}>
                      Reembolsar
                    </button>
                  )}
                  {payingId === expense.id && (
                    <div className="btn-row">
                      <select value={treasuryAccountId} onChange={(e) => setTreasuryAccountId(e.target.value)}>
                        <option value="">Pagar con…</option>
                        {treasuryAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-small btn-primary" onClick={() => handleReimburse(expense)}>
                        Confirmar
                      </button>
                      <button type="button" className="btn btn-small" onClick={() => setPayingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                  {expense.status === 'REJECTED' && expense.rejectionReason && <p className="text-muted">{expense.rejectionReason}</p>}
                  {rowErrors[expense.id] && <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>{rowErrors[expense.id]}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
