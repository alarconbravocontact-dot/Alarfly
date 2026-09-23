import { Fragment, useCallback, useEffect, useState } from 'react';
import { fiscalTransactionsApi, taxRatesApi } from '../../api/fiscal';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const TYPE_LABELS = { SALE: 'Venta', PURCHASE: 'Compra' };
const TYPE_SEAL_TONE = { SALE: 'positive', PURCHASE: 'neutral' };

function emptyForm() {
  return {
    type: 'SALE',
    jurisdictionId: '',
    date: toIsoDate(new Date()),
    counterpartyName: '',
    counterpartyTaxId: '',
    documentNumber: '',
    description: '',
    taxBase: '',
    taxBaseAccountId: '',
    counterpartyAccountId: '',
    taxRateId: '',
    withholdingRateId: '',
  };
}

export default function FiscalTransactionsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';

  const [transactions, setTransactions] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [withholdingRates, setWithholdingRates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedTransaction, setExpandedTransaction] = useState(null);

  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [transactionsData, jurisdictionsData, accountsData] = await Promise.all([
        fiscalTransactionsApi.list(),
        taxRatesApi.listJurisdictions(),
        accountsApi.list({ isActive: true }),
      ]);
      setTransactions(transactionsData);
      setJurisdictions(jurisdictionsData);
      setAccounts(accountsData.filter((a) => a.isPostable));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las transacciones fiscales.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!form.jurisdictionId) {
      setTaxRates([]);
      setWithholdingRates([]);
      return;
    }
    taxRatesApi.listRates({ jurisdictionId: form.jurisdictionId, type: 'VAT', isActive: true }).then(setTaxRates).catch(() => setTaxRates([]));
    taxRatesApi
      .listRates({ jurisdictionId: form.jurisdictionId, type: 'WITHHOLDING', isActive: true })
      .then(setWithholdingRates)
      .catch(() => setWithholdingRates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.jurisdictionId]);

  async function toggleExpand(transaction) {
    if (expandedId === transaction.id) {
      setExpandedId(null);
      setExpandedTransaction(null);
      return;
    }
    setExpandedId(transaction.id);
    try {
      const full = await fiscalTransactionsApi.getOne(transaction.id);
      setExpandedTransaction(full);
    } catch {
      setExpandedTransaction(null);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await fiscalTransactionsApi.create({
        ...form,
        taxBase: Number(form.taxBase),
        documentNumber: form.documentNumber || undefined,
        description: form.description || undefined,
        taxRateId: form.taxRateId || undefined,
        withholdingRateId: form.withholdingRateId || undefined,
      });
      setForm(emptyForm());
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar la transacción fiscal.');
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
              Registrar transacción fiscal
              <HelpTooltip text="Una venta o compra fiscal calcula automáticamente el impuesto y la retención según la jurisdicción elegida, y genera el asiento contable correspondiente." />
            </h2>
          </div>
          <form onSubmit={handleCreate} className="form-grid">
            <label className="field">
              <span>Tipo</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="SALE">Venta</option>
                <option value="PURCHASE">Compra</option>
              </select>
            </label>
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label className="field">
              <span className="field-label">
                Jurisdicción fiscal
                <HelpTooltip text="Define bajo qué reglas fiscales se calcula el impuesto y la retención de esta transacción." />
              </span>
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
              <span>Nombre de la contraparte</span>
              <input value={form.counterpartyName} onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })} required />
            </label>
            <label className="field">
              <span>NIT / RFC de la contraparte</span>
              <input value={form.counterpartyTaxId} onChange={(e) => setForm({ ...form, counterpartyTaxId: e.target.value })} required />
            </label>
            <label className="field">
              <span>N.º de documento (opcional)</span>
              <input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">
                Base gravable
                <HelpTooltip text="El monto sobre el cual se calcula el impuesto y la retención (el valor de la venta o compra, antes de impuestos)." />
              </span>
              <input type="number" min="0.01" step="0.01" value={form.taxBase} onChange={(e) => setForm({ ...form, taxBase: e.target.value })} required />
            </label>
            <label className="field">
              <span>Cuenta de ingreso/gasto</span>
              <select value={form.taxBaseAccountId} onChange={(e) => setForm({ ...form, taxBaseAccountId: e.target.value })} required>
                <option value="">Selecciona una cuenta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                Cuenta de la contraparte
                <HelpTooltip text="La cuenta contable que recibe el otro lado del movimiento (por ejemplo, Cuentas por Cobrar en una venta, o Bancos si se pagó de contado)." />
              </span>
              <select value={form.counterpartyAccountId} onChange={(e) => setForm({ ...form, counterpartyAccountId: e.target.value })} required>
                <option value="">Selecciona una cuenta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                Impuesto (opcional)
                <HelpTooltip text="Si no seleccionas ninguno, el sistema busca automáticamente la tasa vigente para esta jurisdicción y fecha." />
              </span>
              <select value={form.taxRateId} onChange={(e) => setForm({ ...form, taxRateId: e.target.value })} disabled={!form.jurisdictionId}>
                <option value="">Calcular automáticamente</option>
                {taxRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.rate}%)
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Retención (opcional)</span>
              <select value={form.withholdingRateId} onChange={(e) => setForm({ ...form, withholdingRateId: e.target.value })} disabled={!form.jurisdictionId}>
                <option value="">Calcular automáticamente</option>
                {withholdingRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.rate}%)
                  </option>
                ))}
              </select>
            </label>
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
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Registrar transacción'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Transacciones fiscales registradas</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && transactions.length === 0 && (
          <EmptyState icon="§" message="Todavía no registraste ninguna transacción fiscal." />
        )}
        {!isLoading && !loadError && transactions.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Contraparte</th>
                <th className="num">Base</th>
                <th className="num">Impuesto</th>
                <th className="num">Retención</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <Fragment key={t.id}>
                  <tr>
                    <td>{formatDate(new Date(t.date))}</td>
                    <td>
                      <StatusSeal tone={TYPE_SEAL_TONE[t.type]} label={TYPE_LABELS[t.type]} />
                    </td>
                    <td>{t.counterpartyName}</td>
                    <td className="num">{formatCurrency(t.taxBase)}</td>
                    <td className="num">{formatCurrency(t.taxAmount)}</td>
                    <td className="num">{formatCurrency(t.withholdingAmount)}</td>
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => toggleExpand(t)}>
                        {expandedId === t.id ? 'Ocultar' : 'Ver detalle'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === t.id && expandedTransaction && (
                    <tr>
                      <td colSpan={7}>
                        <p className="text-muted">
                          NIT/RFC: {expandedTransaction.counterpartyTaxId} · Jurisdicción: {expandedTransaction.jurisdiction?.name} ·
                          Documento: {expandedTransaction.documentNumber || '—'}
                        </p>
                        <p className="text-muted" style={{ marginTop: 4 }}>
                          Asiento contable: <StatusSeal status={expandedTransaction.journalEntry?.status?.toLowerCase()} label={expandedTransaction.journalEntry?.status} />
                        </p>
                        {expandedTransaction.riskAlerts?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <p className="text-muted">Alertas de riesgo generadas:</p>
                            {expandedTransaction.riskAlerts.map((alert) => (
                              <p key={alert.id} className="alert-box alert-box-warning" style={{ marginTop: 4 }}>
                                {alert.message}
                              </p>
                            ))}
                          </div>
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
