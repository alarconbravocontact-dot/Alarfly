import { useCallback, useEffect, useState } from 'react';
import { apPaymentsApi, vendorsApi, apBillsApi } from '../../api/ap';
import { treasuryAccountsApi } from '../../api/treasury';
import { paymentMethodsApi } from '../../api/sales';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import EmptyState from '../../core/ui/EmptyState';

function emptyApplication() {
  return { billId: '', amount: '' };
}

export default function ApPaymentsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [payments, setPayments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [vendorId, setVendorId] = useState('');
  const [openBills, setOpenBills] = useState([]);
  const [treasuryAccountId, setTreasuryAccountId] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [applications, setApplications] = useState([emptyApplication()]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [paymentsData, vendorsData, treasuryData, paymentMethodsData] = await Promise.all([
        apPaymentsApi.list(),
        vendorsApi.list({ isActive: true }),
        treasuryAccountsApi.list(),
        paymentMethodsApi.list({ isActive: true }),
      ]);
      setPayments(paymentsData);
      setVendors(vendorsData);
      setTreasuryAccounts(treasuryData);
      setPaymentMethods(paymentMethodsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los pagos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!vendorId) {
      setOpenBills([]);
      return;
    }
    apBillsApi
      .list({ vendorId })
      .then((data) => setOpenBills(data.filter((b) => b.status === 'OPEN' || b.status === 'PARTIALLY_PAID')))
      .catch(() => setOpenBills([]));
  }, [vendorId]);

  function updateApplication(index, changes) {
    setApplications((prev) => prev.map((a, i) => (i === index ? { ...a, ...changes } : a)));
  }

  function addApplication() {
    setApplications((prev) => [...prev, emptyApplication()]);
  }

  function removeApplication(index) {
    setApplications((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    const validApplications = applications.filter((a) => a.billId && a.amount);
    if (validApplications.length === 0) {
      setFormError('Debes indicar a qué factura(s) se aplica el pago.');
      return;
    }
    setIsSaving(true);
    try {
      await apPaymentsApi.create({
        vendorId,
        treasuryAccountId,
        date,
        amount: Number(amount),
        paymentMethodId: paymentMethodId || undefined,
        applications: validApplications.map((a) => ({ billId: a.billId, amount: Number(a.amount) })),
      });
      setAmount('');
      setApplications([emptyApplication()]);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2>Registrar pago a proveedor</h2>
          </div>
          <form onSubmit={handleCreate}>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <label className="field">
                <span>Proveedor</span>
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                  <option value="">Selecciona un proveedor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
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
              <label className="field">
                <span>Fecha</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label className="field">
                <span>Monto total del pago</span>
                <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </label>
              <label className="field">
                <span>Método de pago (opcional)</span>
                <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                  <option value="">Sin indicar</option>
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="section-title">Repartir entre facturas</p>
            {applications.map((a, index) => (
              <div key={index} className="btn-row" style={{ alignItems: 'center', marginBottom: 8 }}>
                <select value={a.billId} onChange={(e) => updateApplication(index, { billId: e.target.value })}>
                  <option value="">Selecciona una factura</option>
                  {openBills.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      N.º {bill.billNumber} — saldo {formatCurrency(Number(bill.totalAmount) - Number(bill.paidAmount))}
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
                {applications.length > 1 && (
                  <button type="button" className="btn btn-small btn-danger" onClick={() => removeApplication(index)}>
                    Quitar
                  </button>
                )}
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
                {isSaving ? 'Guardando…' : 'Registrar pago'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Pagos registrados</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && payments.length === 0 && (
          <EmptyState icon="○" message="Todavía no registraste ningún pago a proveedor." />
        )}
        {!isLoading && !loadError && payments.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th className="num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(new Date(p.date))}</td>
                  <td>{p.vendor.name}</td>
                  <td className="num">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
