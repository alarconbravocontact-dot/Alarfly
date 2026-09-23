import { useCallback, useEffect, useState } from 'react';
import { arCreditNotesApi, customersApi, arInvoicesApi } from '../../api/ar';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

export default function ArCreditNotesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [notes, setNotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [type, setType] = useState('CREDIT');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [notesData, customersData] = await Promise.all([arCreditNotesApi.list(), customersApi.list({ isActive: true })]);
      setNotes(notesData);
      setCustomers(customersData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las notas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!customerId) {
      setCustomerInvoices([]);
      return;
    }
    arInvoicesApi
      .list({ customerId })
      .then(setCustomerInvoices)
      .catch(() => setCustomerInvoices([]));
  }, [customerId]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await arCreditNotesApi.create({ invoiceId, type, reason, amount: Number(amount), date });
      setInvoiceId('');
      setReason('');
      setAmount('');
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar la nota.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Registrar nota de crédito o débito
              <HelpTooltip text="Nota de crédito: reduce lo que el cliente debe (ej. una devolución). Nota de débito: aumenta lo que debe (ej. un cargo adicional). Siempre queda ligada a la factura original." />
            </h2>
          </div>
          <form onSubmit={handleCreate} className="form-grid">
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
            <label className="field">
              <span>Factura</span>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required disabled={!customerId}>
                <option value="">Selecciona una factura</option>
                {customerInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    N.º {inv.invoiceNumber} — total {formatCurrency(inv.totalAmount)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tipo</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="CREDIT">Nota de crédito (reduce)</option>
                <option value="DEBIT">Nota de débito (aumenta)</option>
              </select>
            </label>
            <label className="field">
              <span>Monto</span>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="field" style={{ gridColumn: 'span 2' }}>
              <span>Motivo</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Devolución de mercancía" required />
            </label>
            {formError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Registrar nota'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Notas registradas</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && notes.length === 0 && (
          <EmptyState icon="□" message="Todavía no registraste ninguna nota de crédito ni débito." />
        )}
        {!isLoading && !loadError && notes.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>N.º</th>
                <th>Cliente</th>
                <th>Factura</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th className="num">Monto</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id}>
                  <td>{n.noteNumber}</td>
                  <td>{n.customer.name}</td>
                  <td>N.º {n.invoice.invoiceNumber}</td>
                  <td>
                    <StatusSeal
                      status={n.type === 'CREDIT' ? 'active' : 'pending'}
                      label={n.type === 'CREDIT' ? 'Crédito' : 'Débito'}
                    />
                  </td>
                  <td>{n.reason}</td>
                  <td className="num">{formatCurrency(n.amount)}</td>
                  <td>{formatDate(new Date(n.date))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
