import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { apBillsApi, vendorsApi } from '../../api/ap';
import { accountsApi } from '../../api/accounting';
import { taxRatesApi } from '../../api/fiscal';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import DueDateStatus from '../../core/ui/DueDateStatus';
import EmptyState from '../../core/ui/EmptyState';
import ViewSwitcher from '../../core/ui/ViewSwitcher';
import RecordDrawer from '../../core/ui/RecordDrawer';

const STATUS_LABELS = { OPEN: 'Abierta', PARTIALLY_PAID: 'Parcialmente pagada', PAID: 'Pagada', CANCELLED: 'Cancelada' };
const STATUS_SEAL_TONE = { OPEN: 'warning', PARTIALLY_PAID: 'warning', PAID: 'positive', CANCELLED: 'negative' };
const KANBAN_STATUSES = ['OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];
const BILL_VIEWS = [
  { mode: 'LIST', label: 'Lista' },
  { mode: 'KANBAN', label: 'Kanban' },
];

function emptyLine() {
  return { description: '', quantity: 1, unitPrice: '' };
}

export default function ApBillsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [bills, setBills] = useState([]);
  const [warningThresholdDays, setWarningThresholdDays] = useState(7);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [withholdingRates, setWithholdingRates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedBill, setExpandedBill] = useState(null);
  const [billViewMode, setBillViewMode] = useState('LIST');
  // Panel deslizable (drawer, Feature R): estado aparte del expand
  // inline que sigue usando la vista Kanban — no se comparte, para que
  // abrir una tarjeta en Kanban no dispare el drawer sin querer.
  const [drawerId, setDrawerId] = useState(null);
  const [drawerBill, setDrawerBill] = useState(null);

  const [vendorId, setVendorId] = useState('');
  const [jurisdictionId, setJurisdictionId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [issueDate, setIssueDate] = useState(toIsoDate(new Date()));
  const [documentNumber, setDocumentNumber] = useState('');
  const [taxRateId, setTaxRateId] = useState('');
  const [withholdingRateId, setWithholdingRateId] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [billsData, vendorsData, accountsData, jurisdictionsData] = await Promise.all([
        apBillsApi.list(),
        vendorsApi.list({ isActive: true }),
        accountsApi.list({ isActive: true }),
        taxRatesApi.listJurisdictions(),
      ]);
      setBills(billsData);
      setVendors(vendorsData);
      setAccounts(accountsData.filter((a) => a.isPostable));
      setJurisdictions(jurisdictionsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las facturas.');
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

  useEffect(() => {
    if (!jurisdictionId) {
      setTaxRates([]);
      setWithholdingRates([]);
      return;
    }
    taxRatesApi.listRates({ jurisdictionId, type: 'VAT', isActive: true }).then(setTaxRates).catch(() => setTaxRates([]));
    taxRatesApi
      .listRates({ jurisdictionId, type: 'WITHHOLDING', isActive: true })
      .then(setWithholdingRates)
      .catch(() => setWithholdingRates([]));
  }, [jurisdictionId]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 1) * (Number(l.unitPrice) || 0), 0),
    [lines]
  );

  function updateLine(index, changes) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...changes } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function toggleExpand(bill) {
    if (expandedId === bill.id) {
      setExpandedId(null);
      setExpandedBill(null);
      return;
    }
    setExpandedId(bill.id);
    try {
      const full = await apBillsApi.getOne(bill.id);
      setExpandedBill(full);
    } catch {
      setExpandedBill(null);
    }
  }

  const openDrawer = useCallback(async (bill) => {
    setDrawerId(bill.id);
    setDrawerBill(null);
    try {
      setDrawerBill(await apBillsApi.getOne(bill.id));
    } catch {
      setDrawerBill(null);
    }
  }, []);

  function closeDrawer() {
    setDrawerId(null);
    setDrawerBill(null);
  }

  const drawerIndex = useMemo(() => bills.findIndex((b) => b.id === drawerId), [bills, drawerId]);
  function navigateDrawer(direction) {
    const next = bills[drawerIndex + direction];
    if (next) openDrawer(next);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await apBillsApi.create({
        vendorId,
        jurisdictionId,
        expenseAccountId,
        issueDate,
        documentNumber: documentNumber || undefined,
        taxRateId: taxRateId || undefined,
        withholdingRateId: withholdingRateId || undefined,
        lines: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity ? Number(l.quantity) : undefined,
          unitPrice: Number(l.unitPrice) || 0,
        })),
      });
      setDocumentNumber('');
      setLines([emptyLine()]);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar la factura.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2>Registrar factura de compra</h2>
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
                <span>Fecha de emisión</span>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
              </label>
              <label className="field">
                <span>N.º de documento (opcional)</span>
                <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">
                  Jurisdicción fiscal
                  <HelpTooltip text="Define bajo qué reglas fiscales se calcula el impuesto y la retención de esta factura." />
                </span>
                <select value={jurisdictionId} onChange={(e) => setJurisdictionId(e.target.value)} required>
                  <option value="">Selecciona una jurisdicción</option>
                  {jurisdictions.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Cuenta de gasto</span>
                <select value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} required>
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
                  <HelpTooltip text="El impuesto (ej. IVA) que este proveedor te cobra, según la jurisdicción elegida." />
                </span>
                <select value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)} disabled={!jurisdictionId}>
                  <option value="">Sin impuesto</option>
                  {taxRates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.rate}%)
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Retención (opcional)
                  <HelpTooltip text="Si le vas a retener un porcentaje del pago a este proveedor, selecciónalo aquí." />
                </span>
                <select value={withholdingRateId} onChange={(e) => setWithholdingRateId(e.target.value)} disabled={!jurisdictionId}>
                  <option value="">Sin retención</option>
                  {withholdingRates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.rate}%)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Cantidad</th>
                  <th className="num">Precio unitario</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td>
                      <input value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} required />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                        required
                      />
                    </td>
                    <td>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => removeLine(index)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="btn-row" style={{ marginTop: 12, alignItems: 'center' }}>
              <button type="button" className="btn btn-small" onClick={addLine}>
                + Agregar línea
              </button>
              <span className="text-muted">Subtotal: {formatCurrency(total)}</span>
            </div>

            {formError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Registrar factura'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Facturas registradas</h2>
          <ViewSwitcher viewKey="ap-bills" views={BILL_VIEWS} onChange={setBillViewMode} />
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && bills.length === 0 && (
          <EmptyState icon="○" message="Todavía no registraste ninguna factura de compra." />
        )}
        {!isLoading && !loadError && bills.length > 0 && billViewMode === 'KANBAN' && (
          <div className="kanban-board">
            {KANBAN_STATUSES.map((status) => {
              const columnBills = bills.filter((b) => b.status === status);
              return (
                <div key={status} className="kanban-column">
                  <div className="kanban-column-header">
                    <StatusSeal tone={STATUS_SEAL_TONE[status]} label={STATUS_LABELS[status]} />
                    <span className="text-muted">{columnBills.length}</span>
                  </div>
                  {columnBills.length === 0 && <p className="text-muted kanban-column-empty">Sin facturas</p>}
                  {columnBills.map((bill) => (
                    <div key={bill.id} className="kanban-card" onClick={() => toggleExpand(bill)}>
                      <p className="kanban-card-title">
                        N.º {bill.billNumber} · {bill.vendor.name}
                      </p>
                      <p className="kanban-card-amount">{formatCurrency(bill.totalAmount)}</p>
                      <p className="text-muted">{formatDate(new Date(bill.dueDate))}</p>
                      {(bill.status === 'OPEN' || bill.status === 'PARTIALLY_PAID') && (
                        <DueDateStatus dueDate={bill.dueDate} thresholdDays={warningThresholdDays} />
                      )}
                      {expandedId === bill.id && expandedBill && (
                        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Descripción</th>
                                <th className="num">Total línea</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expandedBill.lines.map((l) => (
                                <tr key={l.id}>
                                  <td>{l.description}</td>
                                  <td className="num">{formatCurrency(l.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="text-muted" style={{ marginTop: 6 }}>
                            Total: {formatCurrency(expandedBill.totalAmount)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && !loadError && bills.length > 0 && billViewMode === 'LIST' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>N.º</th>
                <th>Proveedor</th>
                <th>Emisión</th>
                <th>Vencimiento</th>
                <th className="num">Total</th>
                <th className="num">Saldo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <Fragment key={bill.id}>
                  <tr>
                    <td>{bill.billNumber}</td>
                    <td>{bill.vendor.name}</td>
                    <td>{formatDate(new Date(bill.issueDate))}</td>
                    <td>
                      {formatDate(new Date(bill.dueDate))}
                      {(bill.status === 'OPEN' || bill.status === 'PARTIALLY_PAID') && (
                        <div style={{ marginTop: 4 }}>
                          <DueDateStatus dueDate={bill.dueDate} thresholdDays={warningThresholdDays} />
                        </div>
                      )}
                    </td>
                    <td className="num">{formatCurrency(bill.totalAmount)}</td>
                    <td className="num">{formatCurrency(Number(bill.totalAmount) - Number(bill.paidAmount))}</td>
                    <td>
                      <StatusSeal tone={STATUS_SEAL_TONE[bill.status]} label={STATUS_LABELS[bill.status]} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => openDrawer(bill)}>
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RecordDrawer
        isOpen={drawerId !== null}
        onClose={closeDrawer}
        title={drawerBill ? `Factura N.º ${drawerBill.billNumber}` : 'Cargando…'}
        subtitle={drawerBill ? `${drawerBill.vendor.name} · ${STATUS_LABELS[drawerBill.status]}` : ''}
        onNavigate={navigateDrawer}
        hasPrev={drawerIndex > 0}
        hasNext={drawerIndex >= 0 && drawerIndex < bills.length - 1}
        summary={
          drawerBill ? (
            <div>
              <p>
                <strong>Emisión:</strong> {formatDate(new Date(drawerBill.issueDate))}
              </p>
              <p>
                <strong>Vencimiento:</strong> {formatDate(new Date(drawerBill.dueDate))}
              </p>
              <p>
                <strong>Total:</strong> {formatCurrency(drawerBill.totalAmount)}
              </p>
              <p>
                <strong>Saldo pendiente:</strong> {formatCurrency(Number(drawerBill.totalAmount) - Number(drawerBill.paidAmount))}
              </p>
              <p className="text-muted" style={{ marginTop: 12 }}>
                {drawerBill.lines.length} línea{drawerBill.lines.length === 1 ? '' : 's'} de detalle — expande a pantalla completa
                para verlas.
              </p>
            </div>
          ) : (
            <p className="text-muted">Cargando…</p>
          )
        }
        fullDetail={
          drawerBill ? (
            <div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th className="num">Precio unitario</th>
                    <th className="num">Total línea</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerBill.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.description}</td>
                      <td>{l.quantity}</td>
                      <td className="num">{formatCurrency(l.unitPrice)}</td>
                      <td className="num">{formatCurrency(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-muted" style={{ marginTop: 8 }}>
                Subtotal: {formatCurrency(drawerBill.subtotal)} · Impuesto: {formatCurrency(drawerBill.taxAmount)} · Retención:{' '}
                {formatCurrency(drawerBill.withholdingAmount)} · Total: {formatCurrency(drawerBill.totalAmount)}
              </p>
            </div>
          ) : null
        }
      />
    </div>
  );
}
