import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { arPaymentsApi, customersApi, arInvoicesApi } from '../../api/ar';
import { treasuryAccountsApi, bankFeedsApi } from '../../api/treasury';
import { paymentMethodsApi } from '../../api/sales';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';
import AmountInput from '../../core/ui/AmountInput';
import { evaluateMathExpression } from '../../utils/mathExpression';

function emptyApplication() {
  return { invoiceId: '', amount: '' };
}

export default function ArPaymentsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';
  const location = useLocation();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [paymentSource, setPaymentSource] = useState('DIRECT'); // DIRECT | BANK
  const [customerId, setCustomerId] = useState('');
  const [openInvoices, setOpenInvoices] = useState([]);
  const [treasuryAccountId, setTreasuryAccountId] = useState('');
  const [bankTransactionId, setBankTransactionId] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [reference, setReference] = useState('');
  // Fase 6 (sección 15/47): un cobro directo puede registrarse en
  // moneda extranjera (ej. Bs. a la tasa BCV vigente) — reutiliza el
  // mismo snapshot foreignCurrency/foreignAmount/exchangeRate que ya
  // guarda el backend (Fase 3), solo faltaba exponerlo acá.
  const [useForeignCurrency, setUseForeignCurrency] = useState(false);
  const [foreignCurrency, setForeignCurrency] = useState('VES');
  const [foreignAmount, setForeignAmount] = useState('');
  const [applications, setApplications] = useState([emptyApplication()]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedBankTransaction = bankTransactions.find((t) => t.id === bankTransactionId) || null;
  const effectiveAmount = paymentSource === 'BANK' ? selectedBankTransaction?.amount ?? '' : useForeignCurrency ? '' : amount;

  const [advanceErrors, setAdvanceErrors] = useState({});
  const [applyingId, setApplyingId] = useState(null);
  const [applyOpenInvoices, setApplyOpenInvoices] = useState([]);
  const [applyInvoiceId, setApplyInvoiceId] = useState('');
  const [applyAmount, setApplyAmount] = useState('');

  async function startApplyAdvance(payment) {
    setApplyingId(payment.id);
    setApplyInvoiceId('');
    setApplyAmount('');
    try {
      const data = await arInvoicesApi.list({ customerId: payment.customerId });
      setApplyOpenInvoices(data.filter((i) => i.status === 'OPEN' || i.status === 'PARTIALLY_PAID'));
    } catch {
      setApplyOpenInvoices([]);
    }
  }

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [paymentsData, customersData, treasuryData, bankTransactionsData, paymentMethodsData] = await Promise.all([
        arPaymentsApi.list(),
        customersApi.list({ isActive: true }),
        treasuryAccountsApi.list(),
        bankFeedsApi.listTransactions({ status: 'UNMATCHED' }),
        paymentMethodsApi.list({ isActive: true }),
      ]);
      setPayments(paymentsData);
      setCustomers(customersData);
      setTreasuryAccounts(treasuryData);
      setBankTransactions(bankTransactionsData.filter((t) => Number(t.amount) > 0));
      setPaymentMethods(paymentMethodsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los cobros.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Si se llegó acá desde el toast "Registrar un cobro" (Feature L),
  // precarga el cliente elegido y limpia el estado de navegación.
  useEffect(() => {
    const presetCustomerId = location.state?.presetCustomerId;
    if (presetCustomerId) {
      setCustomerId(presetCustomerId);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.presetCustomerId]);

  useEffect(() => {
    if (!customerId) {
      setOpenInvoices([]);
      return;
    }
    arInvoicesApi
      .list({ customerId })
      .then((data) => setOpenInvoices(data.filter((i) => i.status === 'OPEN' || i.status === 'PARTIALLY_PAID')))
      .catch(() => setOpenInvoices([]));
  }, [customerId]);

  function updateApplication(index, changes) {
    setApplications((prev) => prev.map((a, i) => (i === index ? { ...a, ...changes } : a)));
  }

  function addApplication() {
    setApplications((prev) => [...prev, emptyApplication()]);
  }

  function removeApplication(index) {
    setApplications((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    if (paymentSource === 'BANK' && !bankTransactionId) {
      setFormError('Selecciona un movimiento bancario.');
      return;
    }
    setIsSaving(true);
    try {
      const validApplications = applications.filter((a) => a.invoiceId && a.amount);
      const payload = {
        customerId,
        date,
        applications: validApplications.map((a) => ({ invoiceId: a.invoiceId, amount: Number(a.amount) })),
      };
      if (paymentSource === 'BANK') {
        payload.bankTransactionId = bankTransactionId;
      } else {
        payload.treasuryAccountId = treasuryAccountId;
        if (useForeignCurrency) {
          payload.foreignCurrency = foreignCurrency;
          payload.foreignAmount = Number(foreignAmount);
        } else {
          payload.amount = evaluateMathExpression(amount) ?? Number(amount);
        }
        payload.paymentMethodId = paymentMethodId || undefined;
        payload.reference = reference || undefined;
      }
      await arPaymentsApi.create(payload);
      setAmount('');
      setForeignAmount('');
      setReference('');
      setBankTransactionId('');
      setApplications([emptyApplication()]);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar el cobro.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApplyAdvance(payment) {
    setAdvanceErrors((prev) => ({ ...prev, [payment.id]: '' }));
    if (!applyInvoiceId || !applyAmount) {
      setAdvanceErrors((prev) => ({ ...prev, [payment.id]: 'Selecciona una factura e indica el monto.' }));
      return;
    }
    try {
      await arPaymentsApi.applyAdvance(payment.id, [{ invoiceId: applyInvoiceId, amount: Number(applyAmount) }]);
      setApplyingId(null);
      setApplyInvoiceId('');
      setApplyAmount('');
      await loadAll();
    } catch (err) {
      setAdvanceErrors((prev) => ({
        ...prev,
        [payment.id]: err instanceof ApiError ? err.message : 'No se pudo aplicar el anticipo.',
      }));
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Registrar cobro
              <HelpTooltip text="Si repartes el cobro entre facturas abajo, se aplica de una vez. Si lo dejas sin repartir, queda guardado como anticipo — lo puedes aplicar a una factura más adelante desde la lista de abajo." />
            </h2>
          </div>
          <form onSubmit={handleCreate}>
            <label className="field" style={{ marginBottom: 16 }}>
              <span className="field-label">
                Origen del cobro
                <HelpTooltip text="“Movimiento bancario real” liga el cobro a un ingreso que ya llegó al banco (importado en Tesorería › Conciliación) — el monto y la cuenta se toman de ese movimiento, y queda marcado como conciliado. “Directo” es para cobros que no pasan por un extracto, ej. efectivo." />
              </span>
              <select
                value={paymentSource}
                onChange={(e) => {
                  setPaymentSource(e.target.value);
                  setBankTransactionId('');
                }}
              >
                <option value="DIRECT">Directo (efectivo u otro, indico cuenta y monto)</option>
                <option value="BANK">Movimiento bancario real (ya importado en Tesorería)</option>
              </select>
            </label>

            <div className="form-grid" style={{ marginBottom: 16 }}>
              <label className="field">
                <span>Cliente</span>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                  <option value="">Selecciona un cliente</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              {paymentSource === 'BANK' ? (
                <label className="field" style={{ gridColumn: 'span 2' }}>
                  <span>Movimiento bancario</span>
                  <select value={bankTransactionId} onChange={(e) => setBankTransactionId(e.target.value)} required>
                    <option value="">Selecciona un movimiento sin conciliar</option>
                    {bankTransactions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {formatDate(new Date(t.date))} · {t.description} · {formatCurrency(t.amount, t.currency)}
                      </option>
                    ))}
                  </select>
                  {bankTransactions.length === 0 && (
                    <span className="text-muted" style={{ fontSize: 'var(--text-2xs)' }}>
                      No hay movimientos bancarios sin conciliar. Impórtalos desde Tesorería › Conciliación.
                    </span>
                  )}
                </label>
              ) : (
                <>
                  <label className="field">
                    <span>Cuenta de tesorería</span>
                    <select value={treasuryAccountId} onChange={(e) => setTreasuryAccountId(e.target.value)} required>
                      <option value="">Selecciona una cuenta</option>
                      {treasuryAccounts.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {useForeignCurrency ? (
                    <label className="field">
                      <span className="field-label">
                        Monto en {foreignCurrency}
                        <HelpTooltip text="Se convierte solo a la moneda base con la tasa de cambio vigente para esa fecha (la más reciente registrada en Contabilidad › Tasas de Cambio) y esa tasa queda guardada junto al cobro para siempre, aunque después se registre una tasa nueva." />
                      </span>
                      <input type="number" step="0.01" min="0.01" value={foreignAmount} onChange={(e) => setForeignAmount(e.target.value)} required />
                    </label>
                  ) : (
                    <label className="field">
                      <span className="field-label">
                        Monto total del cobro
                        <HelpTooltip text="Puedes escribir una operación simple, ej. “150+30”, y se calcula sola al salir del campo." />
                      </span>
                      <AmountInput value={amount} onChange={setAmount} required />
                    </label>
                  )}
                </>
              )}

              <label className="field">
                <span>Fecha</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              {paymentSource === 'BANK' && selectedBankTransaction && (
                <label className="field">
                  <span>Monto (del movimiento bancario)</span>
                  <input type="text" value={formatCurrency(selectedBankTransaction.amount, selectedBankTransaction.currency)} disabled />
                </label>
              )}
              {paymentSource === 'DIRECT' && (
                <>
                  <label className="field">
                    <span>Método de pago</span>
                    <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                      <option value="">Sin indicar</option>
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">
                      Referencia (opcional)
                      <HelpTooltip text="El número de confirmación de un Pago Móvil, Zelle o Binance, o el número de una transferencia — para poder identificarlo después." />
                    </span>
                    <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej: últimos 4 dígitos, ID de transacción…" />
                  </label>
                  <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={useForeignCurrency} onChange={(e) => setUseForeignCurrency(e.target.checked)} />
                    <span className="field-label">
                      El cliente pagó en otra moneda (ej. Bs.)
                      <HelpTooltip text="Actívalo si el cliente pagó en Bolívares u otra moneda distinta a la moneda base de la empresa — se convierte con la tasa BCV vigente." />
                    </span>
                  </label>
                  {useForeignCurrency && (
                    <label className="field">
                      <span>Moneda</span>
                      <input type="text" value={foreignCurrency} onChange={(e) => setForeignCurrency(e.target.value.toUpperCase())} maxLength={3} required />
                    </label>
                  )}
                </>
              )}
            </div>

            <p className="section-title">
              Repartir entre facturas (opcional — déjalo vacío para guardar como anticipo)
              {effectiveAmount !== '' && ` · Monto disponible: ${formatCurrency(effectiveAmount)}`}
            </p>
            {applications.map((a, index) => (
              <div key={index} className="btn-row" style={{ alignItems: 'center', marginBottom: 8 }}>
                <select value={a.invoiceId} onChange={(e) => updateApplication(index, { invoiceId: e.target.value })}>
                  <option value="">Selecciona una factura</option>
                  {openInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      N.º {inv.invoiceNumber} — saldo {formatCurrency(Number(inv.totalAmount) - Number(inv.paidAmount))}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monto a aplicar"
                  value={a.amount}
                  onChange={(e) => updateApplication(index, { amount: e.target.value })}
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px', width: 160 }}
                />
                <button type="button" className="btn btn-small btn-danger" onClick={() => removeApplication(index)}>
                  Quitar
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-small" onClick={addApplication}>
              + Agregar reparto
            </button>

            {formError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Registrar cobro'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Cobros registrados</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && payments.length === 0 && (
          <EmptyState icon="○" message="Todavía no registraste ningún cobro." />
        )}
        {!isLoading && !loadError && payments.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th className="num">Monto</th>
                <th className="num">Aplicado</th>
                <th className="num">Anticipo sin aplicar</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const applied = p.applications.reduce((sum, a) => sum + Number(a.amount), 0);
                const unapplied = Number(p.amount) - applied;
                return (
                  <tr key={p.id}>
                    <td>{formatDate(new Date(p.date))}</td>
                    <td>{p.customer.name}</td>
                    <td className="num">{formatCurrency(p.amount)}</td>
                    <td className="num">{formatCurrency(applied)}</td>
                    <td className="num">{formatCurrency(unapplied)}</td>
                    {canManage && (
                      <td>
                        {unapplied > 0.004 && applyingId !== p.id && (
                          <button type="button" className="btn btn-small" onClick={() => startApplyAdvance(p)}>
                            Aplicar anticipo
                          </button>
                        )}
                        {unapplied > 0.004 && applyingId === p.id && (
                          <div>
                            <div className="btn-row" style={{ alignItems: 'center' }}>
                              <select value={applyInvoiceId} onChange={(e) => setApplyInvoiceId(e.target.value)}>
                                <option value="">Factura</option>
                                {applyOpenInvoices.map((inv) => (
                                  <option key={inv.id} value={inv.id}>
                                    N.º {inv.invoiceNumber}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Monto"
                                value={applyAmount}
                                onChange={(e) => setApplyAmount(e.target.value)}
                                style={{ width: 100, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px' }}
                              />
                              <button type="button" className="btn btn-small btn-primary" onClick={() => handleApplyAdvance(p)}>
                                Confirmar
                              </button>
                              <button type="button" className="btn btn-small" onClick={() => setApplyingId(null)}>
                                Cancelar
                              </button>
                            </div>
                            {advanceErrors[p.id] && (
                              <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                                {advanceErrors[p.id]}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
