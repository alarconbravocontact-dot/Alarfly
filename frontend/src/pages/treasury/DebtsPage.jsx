import { Fragment, useCallback, useEffect, useState } from 'react';
import { treasuryAccountsApi, debtsApi } from '../../api/treasury';
import { accountsApi } from '../../api/accounting';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import DueDateStatus from '../../core/ui/DueDateStatus';
import EmptyState from '../../core/ui/EmptyState';
import FormField, { RequiredFieldsNote } from '../../core/ui/FormField';

const EMPTY_FORM = {
  type: 'LOAN',
  name: '',
  lender: '',
  principalAmount: '',
  interestRate: '',
  currency: 'USD',
  startDate: toIsoDate(new Date()),
  termMonths: '',
  installmentCount: '',
  treasuryAccountId: '',
  liabilityAccountId: '',
  interestExpenseAccountId: '',
};

export default function DebtsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN';

  const [debts, setDebts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [glAccounts, setGlAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [expandedDebt, setExpandedDebt] = useState(null);
  const [actionError, setActionError] = useState({});
  const [amountInputs, setAmountInputs] = useState({});
  const [warningThresholdDays, setWarningThresholdDays] = useState(7);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [debtsData, accountsData, glData] = await Promise.all([
        debtsApi.list({}),
        treasuryAccountsApi.list({ type: 'BANK_ACCOUNT' }),
        accountsApi.list({ isActive: true }),
      ]);
      setDebts(debtsData);
      setAccounts(accountsData);
      setGlAccounts(glData.filter((a) => a.isPostable));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la deuda.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    accountApi
      .getCompanyProfile()
      .then((c) => setWarningThresholdDays(c.dueDateWarningThresholdDays ?? 7))
      .catch(() => {});
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    try {
      await debtsApi.create({
        ...form,
        principalAmount: Number(form.principalAmount),
        interestRate: Number(form.interestRate),
        termMonths: form.termMonths ? Number(form.termMonths) : undefined,
        installmentCount: form.installmentCount ? Number(form.installmentCount) : undefined,
      });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la deuda.');
    }
  }

  async function toggleExpand(debt) {
    if (expandedId === debt.id) {
      setExpandedId(null);
      setExpandedDebt(null);
      return;
    }
    setExpandedId(debt.id);
    try {
      const full = await debtsApi.getOne(debt.id);
      setExpandedDebt(full);
    } catch {
      setExpandedDebt(null);
    }
  }

  async function refreshExpanded(id) {
    const full = await debtsApi.getOne(id);
    setExpandedDebt(full);
    await loadAll();
  }

  async function handleDisburse(debt) {
    const ok = await confirm({
      title: 'Desembolsar préstamo',
      message: `Vas a desembolsar "${debt.name}" por ${formatCurrency(debt.principalAmount, debt.currency)}. Se generará el asiento contable y el cronograma quedará activo.`,
      confirmLabel: 'Desembolsar',
    });
    if (!ok) return;
    setActionError((prev) => ({ ...prev, [debt.id]: '' }));
    try {
      await debtsApi.disburse(debt.id);
      await refreshExpanded(debt.id);
    } catch (err) {
      setActionError((prev) => ({ ...prev, [debt.id]: err instanceof ApiError ? err.message : 'No se pudo desembolsar.' }));
    }
  }

  async function handleDrawdownOrRepay(debt, action) {
    const amount = amountInputs[debt.id];
    if (!amount) return;
    setActionError((prev) => ({ ...prev, [debt.id]: '' }));
    try {
      if (action === 'drawdown') await debtsApi.drawdown(debt.id, Number(amount));
      if (action === 'repay') await debtsApi.repay(debt.id, Number(amount));
      setAmountInputs((prev) => ({ ...prev, [debt.id]: '' }));
      await refreshExpanded(debt.id);
    } catch (err) {
      setActionError((prev) => ({ ...prev, [debt.id]: err instanceof ApiError ? err.message : 'No se pudo completar la operación.' }));
    }
  }

  async function handlePayInstallment(debt, installment) {
    const ok = await confirm({
      title: 'Pagar cuota',
      message: `Vas a pagar la cuota N.º ${installment.installmentNumber} (${formatCurrency(
        Number(installment.principalPortion) + Number(installment.interestPortion),
        debt.currency
      )}).`,
      confirmLabel: 'Pagar cuota',
    });
    if (!ok) return;
    setActionError((prev) => ({ ...prev, [debt.id]: '' }));
    try {
      await debtsApi.payInstallment(debt.id, installment.id);
      await refreshExpanded(debt.id);
    } catch (err) {
      setActionError((prev) => ({ ...prev, [debt.id]: err instanceof ApiError ? err.message : 'No se pudo pagar la cuota.' }));
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Deuda y líneas de crédito</h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nueva deuda'}
            </button>
          )}
        </div>

        {canManage && isFormOpen && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <FormField
                label="Tipo"
                help="Préstamo: recibes todo el dinero de una vez y lo pagas en cuotas fijas. Línea de crédito: tienes un límite disponible y puedes usar (disponer) y devolver (pagar) montos libremente, como una tarjeta de crédito."
              >
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="LOAN">Préstamo</option>
                  <option value="CREDIT_LINE">Línea de crédito</option>
                </select>
              </FormField>
              <FormField label="Nombre" required>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FormField>
              <FormField label="Entidad prestamista" required>
                <input value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} />
              </FormField>
              <FormField label={form.type === 'LOAN' ? 'Monto del préstamo' : 'Límite de la línea'} required>
                <input
                  type="number"
                  step="0.01"
                  value={form.principalAmount}
                  onChange={(e) => setForm({ ...form, principalAmount: e.target.value })}
                />
              </FormField>
              <FormField label="Tasa de interés anual (%)" required>
                <input type="number" step="0.01" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} />
              </FormField>
              <FormField label="Moneda (ISO)" required>
                <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} />
              </FormField>
              <FormField label="Fecha de inicio" required>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </FormField>
              {form.type === 'LOAN' && (
                <>
                  <FormField
                    label="Plazo en meses"
                    help="En cuánto tiempo total se paga el préstamo — es informativo, sirve como referencia junto al número de cuotas."
                  >
                    <input type="number" value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} />
                  </FormField>
                  {/* Obligatoria solo mientras el tipo es Préstamo (ver el
                      "&&" de arriba) — el asterisco de FormField sigue esa
                      misma condición sin necesitar un mecanismo aparte,
                      porque `required` es una prop normal que ya cambia
                      con `form.type`. */}
                  <FormField
                    label="Número de cuotas"
                    required={form.type === 'LOAN'}
                    help="En cuántos pagos se reparte el préstamo. El sistema arma el cronograma automáticamente: cada cuota amortiza el mismo capital, y el interés baja mes a mes porque se calcula sobre lo que va quedando pendiente."
                  >
                    <input
                      type="number"
                      value={form.installmentCount}
                      onChange={(e) => setForm({ ...form, installmentCount: e.target.value })}
                    />
                  </FormField>
                </>
              )}
              <FormField label="Cuenta de tesorería" required>
                <select value={form.treasuryAccountId} onChange={(e) => setForm({ ...form, treasuryAccountId: e.target.value })}>
                  <option value="">Selecciona una cuenta</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Cuenta contable del pasivo"
                required
                help="La cuenta que representa lo que la empresa debe por este préstamo o línea (ej. “Préstamos por Pagar”)."
              >
                <select value={form.liabilityAccountId} onChange={(e) => setForm({ ...form, liabilityAccountId: e.target.value })}>
                  <option value="">Selecciona una cuenta</option>
                  {glAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Cuenta contable de gasto financiero"
                required
                help="La cuenta donde se registran los intereses que se van pagando (ej. “Gastos Financieros”)."
              >
                <select
                  value={form.interestExpenseAccountId}
                  onChange={(e) => setForm({ ...form, interestExpenseAccountId: e.target.value })}
                >
                  <option value="">Selecciona una cuenta</option>
                  {glAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <RequiredFieldsNote />
            {formError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{formError}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary">
                Crear deuda
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && debts.length === 0 && (
          <EmptyState icon="◇" message="Todavía no registraste ningún préstamo ni línea de crédito." />
        )}
        {!isLoading && !loadError && debts.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th className="num">Saldo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => (
                <Fragment key={d.id}>
                  <tr>
                    <td>
                      {d.name}
                      <span className="text-muted"> — {d.lender}</span>
                    </td>
                    <td>{d.type === 'LOAN' ? 'Préstamo' : 'Línea de crédito'}</td>
                    <td className="num">{formatCurrency(d.outstandingBalance, d.currency)}</td>
                    <td>
                      <StatusSeal
                        status={d.status === 'ACTIVE' ? 'active' : d.status === 'PAID_OFF' ? 'active' : 'cancelled'}
                        label={d.status === 'ACTIVE' ? 'Activa' : d.status === 'PAID_OFF' ? 'Pagada' : 'Cancelada'}
                      />
                    </td>
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => toggleExpand(d)}>
                        {expandedId === d.id ? 'Ocultar' : 'Ver detalle'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === d.id && expandedDebt && (
                    <tr>
                      <td colSpan={5}>
                        {actionError[d.id] && <p className="alert-box alert-box-error" style={{ marginBottom: 12 }}>{actionError[d.id]}</p>}

                        {canManage && d.type === 'LOAN' && !expandedDebt.isDisbursed && (
                          <div className="btn-row" style={{ marginBottom: 16 }}>
                            <button type="button" className="btn btn-primary btn-small" onClick={() => handleDisburse(d)}>
                              Desembolsar
                            </button>
                          </div>
                        )}

                        {canManage && d.type === 'CREDIT_LINE' && d.status === 'ACTIVE' && (
                          <div className="btn-row" style={{ marginBottom: 16, alignItems: 'center' }}>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Monto"
                              value={amountInputs[d.id] || ''}
                              onChange={(e) => setAmountInputs((prev) => ({ ...prev, [d.id]: e.target.value }))}
                              style={{
                                background: 'var(--color-bg)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '8px 11px',
                                width: 120,
                              }}
                            />
                            <button type="button" className="btn btn-small" onClick={() => handleDrawdownOrRepay(d, 'drawdown')}>
                              Disponer
                            </button>
                            <button type="button" className="btn btn-small" onClick={() => handleDrawdownOrRepay(d, 'repay')}>
                              Pagar
                            </button>
                            <HelpTooltip text="Disponer: usar dinero de la línea de crédito (sube lo que debes). Pagar: devolver parte o todo lo usado (baja lo que debes, y vuelve a estar disponible)." />
                          </div>
                        )}

                        {expandedDebt.installments?.length > 0 && (
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Cuota</th>
                                <th>Vencimiento</th>
                                <th className="num">Capital</th>
                                <th className="num">Interés</th>
                                <th>Estado</th>
                                {canManage && <th></th>}
                              </tr>
                            </thead>
                            <tbody>
                              {expandedDebt.installments.map((inst) => (
                                <tr key={inst.id}>
                                  <td>{inst.installmentNumber}</td>
                                  <td>
                                    {formatDate(new Date(inst.dueDate))}
                                    {inst.status === 'PENDING' && (
                                      <div style={{ marginTop: 4 }}>
                                        <DueDateStatus dueDate={inst.dueDate} thresholdDays={warningThresholdDays} />
                                      </div>
                                    )}
                                  </td>
                                  <td className="num">{formatCurrency(inst.principalPortion, d.currency)}</td>
                                  <td className="num">{formatCurrency(inst.interestPortion, d.currency)}</td>
                                  <td>
                                    <StatusSeal
                                      status={inst.status === 'PAID' ? 'active' : 'pending'}
                                      label={inst.status === 'PAID' ? 'Pagada' : 'Pendiente'}
                                    />
                                  </td>
                                  {canManage && (
                                    <td>
                                      {inst.status === 'PENDING' && expandedDebt.isDisbursed && (
                                        <button type="button" className="btn btn-small" onClick={() => handlePayInstallment(d, inst)}>
                                          Pagar
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
