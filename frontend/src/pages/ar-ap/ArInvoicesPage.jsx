import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { arInvoicesApi, arRecurringTemplatesApi, customersApi } from '../../api/ar';
import { accountsApi } from '../../api/accounting';
import { taxRatesApi } from '../../api/fiscal';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import FilterBuilder from '../../components/FilterBuilder';
import StatusSeal from '../../core/ui/StatusSeal';
import Breadcrumb from '../../core/ui/Breadcrumb';
import DueDateStatus from '../../core/ui/DueDateStatus';
import DataTable from '../../core/ui/DataTable';
import DocumentTimeline from '../../core/ui/DocumentTimeline';
import EntityAutocomplete from '../../core/ui/EntityAutocomplete';
import QuickCreateModal from '../../core/ui/QuickCreateModal';
import RecordDrawer from '../../core/ui/RecordDrawer';
import DocumentActionsMenu from '../../core/ui/DocumentActionsMenu';
import { EMAIL_TEMPLATES } from '../../utils/emailTemplates';
import { recentlyUsedApi } from '../../api/recently-used';

const CUSTOMER_QUICK_CREATE_FIELDS = [
  { key: 'name', label: 'Nombre', type: 'text', required: true, autoFocus: true },
  { key: 'email', label: 'Correo (opcional)', type: 'text' },
];

const STATUS_LABELS = { OPEN: 'Abierta', PARTIALLY_PAID: 'Parcialmente pagada', PAID: 'Pagada', CANCELLED: 'Cancelada' };
const STATUS_SEAL_TONE = { OPEN: 'warning', PARTIALLY_PAID: 'warning', PAID: 'positive', CANCELLED: 'negative' };

const INVOICE_FILTER_FIELDS = [
  { key: 'invoiceNumber', label: 'N.º de factura', type: 'text' },
  { key: 'customer.name', label: 'Cliente', type: 'text' },
  { key: 'issueDate', label: 'Fecha de emisión', type: 'date' },
  { key: 'dueDate', label: 'Fecha de vencimiento', type: 'date' },
  { key: 'totalAmount', label: 'Monto total', type: 'number' },
  {
    key: 'status',
    label: 'Estado',
    type: 'select',
    options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
  },
];

function emptyLine() {
  return { description: '', quantity: 1, unitPrice: '' };
}

export default function ArInvoicesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const drillDown = location.state?.drillDown;
  const presetCustomerId = location.state?.presetCustomerId;
  const initialFilterConditions = useMemo(
    () =>
      drillDown
        ? {
            logic: 'all',
            conditions: [
              { field: 'issueDate', op: 'gte', value: drillDown.from },
              { field: 'issueDate', op: 'lte', value: drillDown.to },
            ],
          }
        : undefined,
    [drillDown]
  );

  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [warningThresholdDays, setWarningThresholdDays] = useState(7);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [withholdingRates, setWithholdingRates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [expandedTimeline, setExpandedTimeline] = useState(null);

  const [customerId, setCustomerId] = useState('');
  const [jurisdictionId, setJurisdictionId] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [issueDate, setIssueDate] = useState(toIsoDate(new Date()));
  const [documentNumber, setDocumentNumber] = useState('');
  const [taxRateId, setTaxRateId] = useState('');
  const [withholdingRateId, setWithholdingRateId] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [quickCreateCustomerTerm, setQuickCreateCustomerTerm] = useState(null);
  const [customerFlashKey, setCustomerFlashKey] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [recurrenceSuggestion, setRecurrenceSuggestion] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateMessage, setTemplateMessage] = useState('');
  const formRef = useRef(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [invoicesData, customersData, accountsData, jurisdictionsData] = await Promise.all([
        arInvoicesApi.list(),
        customersApi.list({ isActive: true }),
        accountsApi.list({ isActive: true }),
        taxRatesApi.listJurisdictions(),
      ]);
      setInvoices(invoicesData);
      setCustomers(customersData);
      setAccounts(accountsData.filter((a) => a.isPostable));
      setJurisdictions(jurisdictionsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las facturas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplates(await arRecurringTemplatesApi.list());
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Si se llegó acá desde el toast "Crear factura para este cliente"
  // (Feature L), precarga el cliente elegido y limpia el estado de
  // navegación para que un refresh de la página no lo vuelva a aplicar.
  useEffect(() => {
    if (presetCustomerId) {
      setCustomerId(presetCustomerId);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCustomerId]);

  useEffect(() => {
    if (canManage) loadTemplates();
  }, [canManage, loadTemplates]);

  // Umbral de la Etiqueta de Estado de Vencimiento (configurable por
  // el Administrador desde Mi Cuenta); si no se puede cargar, se usa
  // el default de 7 días sin bloquear el resto de la pantalla.
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

  const activeTemplates = useMemo(() => templates.filter((t) => t.isActive), [templates]);

  function updateLine(index, changes) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...changes } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  // Panel deslizable (drawer, Feature R): abrir una factura ya no
  // expande la fila inline — desliza un panel desde el borde derecho
  // con una previsualización resumida, sin navegar a una pantalla
  // nueva (este proyecto no tiene rutas por registro).
  const openDrawer = useCallback(async (invoice) => {
    setExpandedId(invoice.id);
    setExpandedInvoice(null);
    setExpandedTimeline(null);
    try {
      const full = await arInvoicesApi.getOne(invoice.id);
      setExpandedInvoice(full);
    } catch {
      setExpandedInvoice(null);
    }
    // Línea de tiempo (Feature I): se alimenta del AuditLog real, se
    // pide aparte porque no forma parte del recurso principal de la
    // factura — si falla, el resto del detalle sigue mostrándose.
    try {
      setExpandedTimeline(await arInvoicesApi.timeline(invoice.id));
    } catch {
      setExpandedTimeline(null);
    }
  }, []);

  function closeDrawer() {
    setExpandedId(null);
    setExpandedInvoice(null);
    setExpandedTimeline(null);
  }

  // Innovación pedida explícitamente: mientras el panel está abierto,
  // las flechas ↑/↓ navegan entre los registros consecutivos de la
  // MISMA lista ya filtrada que está en pantalla (nunca la lista sin
  // filtrar), para que la navegación calce con lo que el usuario ve.
  const drawerIndex = useMemo(
    () => filteredInvoices.findIndex((inv) => inv.id === expandedId),
    [filteredInvoices, expandedId]
  );
  function navigateDrawer(direction) {
    const next = filteredInvoices[drawerIndex + direction];
    if (next) openDrawer(next);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      const created = await arInvoicesApi.create({
        customerId,
        jurisdictionId,
        incomeAccountId,
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
      const registeredCustomerId = customerId;
      setDocumentNumber('');
      setLines([emptyLine()]);
      setRecurrenceSuggestion(null);
      await loadAll();
      // Siguiente paso lógico evidente tras registrar una factura
      // (innovación pedida explícitamente): ofrecer registrar el cobro
      // de una vez, con el cliente ya elegido.
      showToast({
        message: `Factura N.º ${created.invoiceNumber} registrada.`,
        actionLabel: 'Registrar un cobro',
        onAction: () => navigate('/cuentas/cobros', { state: { presetCustomerId: registeredCustomerId } }),
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar la factura.');
    } finally {
      setIsSaving(false);
    }
  }

  // Acción "Duplicar" (Feature H): precarga el formulario con los mismos
  // datos de la factura elegida, pero con la fecha de hoy y sin número de
  // documento (se le asigna uno nuevo al guardar) — el propio formulario
  // ya precargado y todavía sin enviar cumple el rol de "borrador", ya
  // que AR no tiene un estado Borrador persistido (ver CLAUDE.md). De
  // paso revisa si esta factura forma parte de un patrón mensual real
  // (mismo cliente, mismo monto, ~30 días de por medio) y, si lo
  // encuentra, sugiere activar una recurrencia automática en vez de
  // seguir duplicando cada mes — la innovación pedida explícitamente.
  async function handleDuplicate(invoiceId) {
    setDuplicatingId(invoiceId);
    setFormError('');
    setRecurrenceSuggestion(null);
    try {
      const full = await arInvoicesApi.getOne(invoiceId);
      setCustomerId(full.customerId);
      setJurisdictionId(full.jurisdictionId);
      setIncomeAccountId(full.incomeAccountId);
      setIssueDate(toIsoDate(new Date()));
      setDocumentNumber('');
      setTaxRateId(full.fiscalTransaction?.taxRateId || '');
      setWithholdingRateId(full.fiscalTransaction?.withholdingRateId || '');
      setLines(
        full.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }))
      );
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const pattern = await arInvoicesApi.recurrenceCheck(invoiceId);
      if (pattern.isRecurring) {
        setRecurrenceSuggestion({
          occurrences: pattern.occurrences,
          amount: pattern.amount,
          customerName: full.customer.name,
          templateData: {
            customerId: full.customerId,
            jurisdictionId: full.jurisdictionId,
            incomeAccountId: full.incomeAccountId,
            taxRateId: full.fiscalTransaction?.taxRateId || undefined,
            withholdingRateId: full.fiscalTransaction?.withholdingRateId || undefined,
            linesSnapshot: full.lines.map((l) => ({
              description: l.description,
              quantity: Number(l.quantity),
              unitPrice: Number(l.unitPrice),
            })),
          },
        });
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo cargar la factura para duplicarla.');
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleActivateRecurrence() {
    if (!recurrenceSuggestion) return;
    setTemplateMessage('');
    try {
      await arRecurringTemplatesApi.create(recurrenceSuggestion.templateData);
      setTemplateMessage(`Recurrencia automática activada para "${recurrenceSuggestion.customerName}" — se generará una factura nueva cada mes, sin que tengas que duplicarla a mano.`);
      setRecurrenceSuggestion(null);
      await loadTemplates();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo activar la recurrencia automática.');
    }
  }

  async function handleDeactivateTemplate(id) {
    try {
      await arRecurringTemplatesApi.deactivate(id);
      await loadTemplates();
    } catch {
      // No bloquea la pantalla si falla — la lista simplemente no se actualiza.
    }
  }

  const invoiceColumns = useMemo(
    () => [
      { key: 'number', label: 'N.º', value: (inv) => inv.invoiceNumber, defaultWidth: 70 },
      { key: 'customer', label: 'Cliente', value: (inv) => inv.customer.name, defaultWidth: 180 },
      { key: 'issueDate', label: 'Emisión', value: (inv) => formatDate(new Date(inv.issueDate)), defaultWidth: 110 },
      {
        key: 'dueDate',
        label: 'Vencimiento',
        value: (inv) => formatDate(new Date(inv.dueDate)),
        render: (inv) => (
          <>
            {formatDate(new Date(inv.dueDate))}
            {(inv.status === 'OPEN' || inv.status === 'PARTIALLY_PAID') && (
              <div style={{ marginTop: 4 }}>
                <DueDateStatus dueDate={inv.dueDate} thresholdDays={warningThresholdDays} />
              </div>
            )}
          </>
        ),
        defaultWidth: 160,
      },
      { key: 'total', label: 'Total', align: 'num', value: (inv) => formatCurrency(inv.totalAmount), defaultWidth: 110 },
      {
        key: 'balance',
        label: 'Saldo',
        align: 'num',
        value: (inv) => formatCurrency(Number(inv.totalAmount) - Number(inv.paidAmount)),
        defaultWidth: 110,
      },
      {
        key: 'status',
        label: 'Estado',
        value: (inv) => STATUS_LABELS[inv.status],
        render: (inv) => <StatusSeal tone={STATUS_SEAL_TONE[inv.status]} label={STATUS_LABELS[inv.status]} />,
        defaultWidth: 150,
      },
      {
        key: 'actions',
        label: '',
        exportable: false,
        render: (inv) => (
          <div className="btn-row" style={{ flexWrap: 'nowrap' }}>
            <button type="button" className="btn btn-small" onClick={() => openDrawer(inv)}>
              Ver detalle
            </button>
            {canManage && (
              <button type="button" className="btn btn-small" onClick={() => handleDuplicate(inv.id)} disabled={duplicatingId === inv.id}>
                {duplicatingId === inv.id ? 'Cargando…' : 'Duplicar'}
              </button>
            )}
          </div>
        ),
        defaultWidth: 200,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [warningThresholdDays, openDrawer, canManage, duplicatingId]
  );

  return (
    <div className="page">
      {drillDown && (
        <Breadcrumb
          items={[{ label: 'Panel principal', to: '/' }, { label: 'Facturas de venta' }, { label: drillDown.monthLabel }]}
        />
      )}
      {canManage && (
        <div className="panel" ref={formRef}>
          <div className="panel-header">
            <h2>Registrar factura de venta</h2>
          </div>
          {templateMessage && (
            <p className="alert-box alert-box-success" style={{ marginBottom: 12 }}>
              {templateMessage}
            </p>
          )}
          {recurrenceSuggestion && (
            <p className="alert-box alert-box-warning" style={{ marginBottom: 12 }}>
              Esta factura parece repetirse cada mes con <strong>{recurrenceSuggestion.customerName}</strong> por el mismo monto (
              {formatCurrency(recurrenceSuggestion.amount)}, van {recurrenceSuggestion.occurrences} veces). En vez de duplicarla cada
              mes, puedes activar la recurrencia automática y Alarfly la genera sola.
              <span className="btn-row" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-small btn-primary" onClick={handleActivateRecurrence}>
                  Activar recurrencia automática
                </button>
                <button type="button" className="btn btn-small" onClick={() => setRecurrenceSuggestion(null)}>
                  No, gracias
                </button>
              </span>
            </p>
          )}
          <form onSubmit={handleCreate}>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <label className="field">
                <span>Cliente</span>
                <EntityAutocomplete
                  entityType="customer"
                  items={customers}
                  getId={(c) => c.id}
                  getLabel={(c) => c.name}
                  getSearchText={(c) => c.name}
                  value={customerId}
                  onChange={(id) => setCustomerId(id)}
                  onCreateNew={(term) => setQuickCreateCustomerTerm(term)}
                  createLabel="cliente"
                  placeholder="Buscar cliente…"
                  flashKey={customerFlashKey}
                  required
                />
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
                  <HelpTooltip text="Define bajo qué reglas fiscales se calcula el impuesto y la retención de esta factura (cada país o región puede tener las suyas)." />
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
                <span>Cuenta de ingreso</span>
                <select value={incomeAccountId} onChange={(e) => setIncomeAccountId(e.target.value)} required>
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
                  <HelpTooltip text="El impuesto (ej. IVA) que aplica a esta venta, según la jurisdicción elegida. Si no aplica ninguno, déjalo sin seleccionar." />
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
                  <HelpTooltip text="Si tu cliente te va a retener un porcentaje del pago (común en algunos países), selecciónalo aquí. Se descuenta del total a cobrar." />
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

      {canManage && activeTemplates.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Recurrencias automáticas activas
              <HelpTooltip text="Cada plantilla vuelve a facturar sola al mismo cliente, con el mismo monto, una vez al mes — nace cuando aceptas la sugerencia al duplicar una factura repetida." />
            </h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Última generada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeTemplates.map((t) => (
                <tr key={t.id}>
                  <td>{t.customer.name}</td>
                  <td>{t.lastGeneratedAt ? formatDate(new Date(t.lastGeneratedAt)) : 'Todavía no se ha generado'}</td>
                  <td>
                    <button type="button" className="btn btn-small btn-danger" onClick={() => handleDeactivateTemplate(t.id)}>
                      Desactivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Facturas registradas</h2>
        </div>
        {!isLoading && !loadError && invoices.length > 0 && (
          <FilterBuilder
            tableKey="ar-invoices"
            fields={INVOICE_FILTER_FIELDS}
            data={invoices}
            onFilteredChange={setFilteredInvoices}
            initialConditions={initialFilterConditions}
          />
        )}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {(isLoading || !loadError) && (
          <DataTable
            tableKey="ar-invoices"
            columns={invoiceColumns}
            data={filteredInvoices}
            rowKey={(inv) => inv.id}
            isLoading={isLoading}
            emptyIcon="●"
            emptyMessage={invoices.length === 0 ? 'Todavía no registraste ninguna factura de venta.' : 'Ningún resultado con estos filtros.'}
            exportTitle="Facturas de Venta"
          />
        )}
      </div>

      <RecordDrawer
        isOpen={expandedId !== null}
        onClose={closeDrawer}
        title={expandedInvoice ? `Factura N.º ${expandedInvoice.invoiceNumber}` : 'Cargando…'}
        subtitle={expandedInvoice ? `${expandedInvoice.customer.name} · ${STATUS_LABELS[expandedInvoice.status]}` : ''}
        onNavigate={navigateDrawer}
        hasPrev={drawerIndex > 0}
        hasNext={drawerIndex >= 0 && drawerIndex < filteredInvoices.length - 1}
        footer={
          expandedInvoice ? (
            <DocumentActionsMenu
              emailTemplates={EMAIL_TEMPLATES['ar-invoice']}
              emailRecipient={expandedInvoice.customer.email || ''}
              emailContext={{
                customerName: expandedInvoice.customer.name,
                invoiceNumber: expandedInvoice.invoiceNumber,
                amount: formatCurrency(Number(expandedInvoice.totalAmount) - Number(expandedInvoice.paidAmount)),
                dueDate: formatDate(new Date(expandedInvoice.dueDate)),
              }}
            />
          ) : null
        }
        summary={
          expandedInvoice ? (
            <div>
              <p>
                <strong>Emisión:</strong> {formatDate(new Date(expandedInvoice.issueDate))}
              </p>
              <p>
                <strong>Vencimiento:</strong> {formatDate(new Date(expandedInvoice.dueDate))}
              </p>
              <p>
                <strong>Total:</strong> {formatCurrency(expandedInvoice.totalAmount)}
              </p>
              <p>
                <strong>Saldo pendiente:</strong>{' '}
                {formatCurrency(Number(expandedInvoice.totalAmount) - Number(expandedInvoice.paidAmount))}
              </p>
              <p className="text-muted" style={{ marginTop: 12 }}>
                {expandedInvoice.lines.length} línea{expandedInvoice.lines.length === 1 ? '' : 's'} de detalle — expande a pantalla
                completa para verlas junto con la línea de tiempo.
              </p>
            </div>
          ) : (
            <p className="text-muted">Cargando…</p>
          )
        }
        fullDetail={
          expandedInvoice ? (
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
                  {expandedInvoice.lines.map((l) => (
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
                Subtotal: {formatCurrency(expandedInvoice.subtotal)} · Impuesto: {formatCurrency(expandedInvoice.taxAmount)} · Retención:{' '}
                {formatCurrency(expandedInvoice.withholdingAmount)} · Total: {formatCurrency(expandedInvoice.totalAmount)}
              </p>
              <h3 className="field-label" style={{ marginTop: 16, marginBottom: 8 }}>
                Línea de tiempo
                <HelpTooltip text="Cada paso viene directo del historial de auditoría real de la factura — quién lo hizo, cuándo, y el documento relacionado (ej. una nota de crédito) si aplica." />
              </h3>
              {expandedTimeline ? (
                <DocumentTimeline steps={expandedTimeline.steps} anomaly={expandedTimeline.anomaly} />
              ) : (
                <p className="text-muted">Cargando línea de tiempo…</p>
              )}
            </div>
          ) : null
        }
      />

      {quickCreateCustomerTerm !== null && (
        <QuickCreateModal
          title="Crear cliente"
          fields={CUSTOMER_QUICK_CREATE_FIELDS}
          initialValues={{ name: quickCreateCustomerTerm }}
          onSubmit={(values) => customersApi.create(values)}
          onSuccess={(created) => {
            setCustomers((prev) => [...prev, created]);
            setCustomerId(created.id);
            setCustomerFlashKey(created.id);
            setQuickCreateCustomerTerm(null);
            recentlyUsedApi.record('customer', created.id).catch(() => {});
          }}
          onCancel={() => setQuickCreateCustomerTerm(null)}
        />
      )}
    </div>
  );
}
