import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { treasuryAccountsApi, paymentApprovalRulesApi, paymentOrdersApi, paymentBatchesApi, paymentCalendarApi } from '../../api/treasury';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import ViewSwitcher from '../../core/ui/ViewSwitcher';

const ROLES = ['ADMIN', 'ACCOUNTANT', 'FINANCE', 'COLLABORATOR'];
const STATUS_LABELS = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente de aprobación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
};
const STATUS_SEAL_TONE = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'positive',
  PAID: 'positive',
  REJECTED: 'negative',
  CANCELLED: 'neutral',
};
const KANBAN_COLUMNS = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'];
const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Misma clave de día (año-mes-día en UTC) que usa el backend para
// agrupar documentos y detectar concentración — las fechas de
// vencimiento se guardan en UTC, así que comparar en UTC evita que un
// documento "salte" de día por el huso horario del navegador.
function utcDateKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const DOCUMENT_TYPE_LABELS = { AP_BILL: 'Factura de compra', DEBT_INSTALLMENT: 'Cuota de deuda', PAYMENT_ORDER: 'Orden de pago' };

// Detalle de niveles/aprobaciones de una orden — compartido entre la
// fila expandida de la vista Lista y la tarjeta expandida de Kanban,
// para no duplicar este bloque en las dos vistas.
function OrderApprovalDetail({ order, expandedOrder, canApprove, runOrderAction }) {
  if (!expandedOrder) return null;
  return (
    <div>
      {/* Rediseño UX/UI (Etapa 5, bloque Aprobaciones) — bug real
          corregido: faltaba "quién solicita", la mitad del
          maker-checker que el documento maestro exige mostrar junto a
          "quién aprobó" (que la tabla de abajo sí mostraba, solo que
          sin el nombre — ver también el fix de "Decisión" debajo). El
          dato ya lo devolvía el backend en otros lugares (relación
          `createdByUser` del schema); solo faltaba pedirlo en esta
          consulta puntual — ver payment-orders.service.getPaymentOrder. */}
      <p className="text-muted" style={{ marginBottom: 8 }}>
        Solicitado por: <strong>{expandedOrder.createdByUser?.name || '—'}</strong>
        {' · '}
        Niveles requeridos: {expandedOrder.requiredLevels} · Aprobaciones registradas: {expandedOrder.approvals?.length ?? 0}
      </p>
      {expandedOrder.approvals?.length > 0 && (
        <table className="data-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>Nivel</th>
              <th>Decidido por</th>
              <th>Decisión</th>
              <th>Comentario</th>
            </tr>
          </thead>
          <tbody>
            {expandedOrder.approvals.map((a) => (
              <tr key={a.id}>
                <td>{a.level}</td>
                <td>{a.approvedByUser?.name || '—'}</td>
                <td>{a.decision === 'APPROVED' ? 'Aprobado' : 'Rechazado'}</td>
                <td>{a.comment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canApprove && order.status === 'PENDING_APPROVAL' && (
        <div className="btn-row">
          <button type="button" className="btn btn-small btn-primary" onClick={() => runOrderAction(order, 'decide', { decision: 'APPROVED' })}>
            Aprobar este nivel
          </button>
          <button type="button" className="btn btn-small btn-danger" onClick={() => runOrderAction(order, 'decide', { decision: 'REJECTED' })}>
            Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

function emptyLevel() {
  return { level: 1, allowedRoles: [] };
}

export default function PaymentOrdersPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';
  const canApprove = user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  const [accounts, setAccounts] = useState([]);
  const [glAccounts, setGlAccounts] = useState([]);
  const [rules, setRules] = useState([]);
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [accountsData, glData, rulesData, ordersData, batchesData] = await Promise.all([
        treasuryAccountsApi.list({ type: 'BANK_ACCOUNT' }),
        accountsApi.list({ isActive: true }),
        paymentApprovalRulesApi.list(),
        paymentOrdersApi.list({}),
        paymentBatchesApi.list(),
      ]);
      setAccounts(accountsData);
      setGlAccounts(glData.filter((a) => a.isPostable));
      setRules(rulesData);
      setOrders(ordersData);
      setBatches(batchesData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la información de pagos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // --- Reglas de aprobación ---
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', minAmount: '', maxAmount: '', levels: [emptyLevel()] });
  const [ruleError, setRuleError] = useState('');

  function toggleRole(index, role) {
    setRuleForm((prev) => ({
      ...prev,
      levels: prev.levels.map((l, i) =>
        i === index ? { ...l, allowedRoles: l.allowedRoles.includes(role) ? l.allowedRoles.filter((r) => r !== role) : [...l.allowedRoles, role] } : l
      ),
    }));
  }
  function addLevel() {
    setRuleForm((prev) => ({ ...prev, levels: [...prev.levels, { level: prev.levels.length + 1, allowedRoles: [] }] }));
  }

  async function handleCreateRule(event) {
    event.preventDefault();
    setRuleError('');
    try {
      await paymentApprovalRulesApi.create({
        name: ruleForm.name,
        minAmount: Number(ruleForm.minAmount),
        maxAmount: ruleForm.maxAmount ? Number(ruleForm.maxAmount) : null,
        levels: ruleForm.levels,
      });
      setRuleForm({ name: '', minAmount: '', maxAmount: '', levels: [emptyLevel()] });
      setIsRuleFormOpen(false);
      await loadAll();
    } catch (err) {
      setRuleError(err instanceof ApiError ? err.message : 'No se pudo crear la regla.');
    }
  }

  async function handleDeactivateRule(rule) {
    const ok = await confirm({
      title: 'Desactivar regla',
      message: `Vas a desactivar la regla "${rule.name}". Las órdenes nuevas ya no la usarán.`,
      confirmLabel: 'Desactivar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await paymentApprovalRulesApi.deactivate(rule.id);
      await loadAll();
    } catch {
      // se muestra en la lista al recargar
    }
  }

  // --- Órdenes de pago ---
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    treasuryAccountId: '',
    glAccountId: '',
    payeeName: '',
    payeeBankName: '',
    payeeAccountNumber: '',
    amount: '',
    currency: 'USD',
    description: '',
    scheduledDate: toIsoDate(new Date()),
  });
  const [orderError, setOrderError] = useState('');
  const [orderActionError, setOrderActionError] = useState({});
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);

  // --- Vista Lista/Kanban/Calendario ---
  const [orderViewMode, setOrderViewMode] = useState('LIST');
  // Calendario de Pagos: ubica CADA documento con vencimiento real que
  // representa una salida de dinero (facturas de compra abiertas, cuotas
  // de deuda pendientes, órdenes de pago sin aprobar) — no solo las
  // órdenes de esta pantalla — vía GET /treasury/payment-calendar, que
  // reutiliza la Previsión de Liquidez ya existente para el saldo
  // semanal proyectado.
  const [calendarData, setCalendarData] = useState(null);
  const [calendarError, setCalendarError] = useState('');
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  useEffect(() => {
    if (orderViewMode !== 'CALENDAR' || calendarData) return;
    setIsCalendarLoading(true);
    setCalendarError('');
    paymentCalendarApi
      .get(4)
      .then((data) => setCalendarData(data))
      .catch((err) => setCalendarError(err instanceof ApiError ? err.message : 'No se pudo cargar el calendario de pagos.'))
      .finally(() => setIsCalendarLoading(false));
  }, [orderViewMode, calendarData]);

  async function handleCreateOrder(event) {
    event.preventDefault();
    setOrderError('');
    try {
      await paymentOrdersApi.create({ ...orderForm, amount: Number(orderForm.amount) });
      setOrderForm({
        treasuryAccountId: '',
        glAccountId: '',
        payeeName: '',
        payeeBankName: '',
        payeeAccountNumber: '',
        amount: '',
        currency: 'USD',
        description: '',
        scheduledDate: toIsoDate(new Date()),
      });
      setIsOrderFormOpen(false);
      await loadAll();
      setCalendarData(null);
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : 'No se pudo crear la orden de pago.');
    }
  }

  async function toggleOrderExpand(order) {
    if (expandedOrderId === order.id) {
      setExpandedOrderId(null);
      setExpandedOrder(null);
      return;
    }
    setExpandedOrderId(order.id);
    try {
      const full = await paymentOrdersApi.getOne(order.id);
      setExpandedOrder(full);
    } catch {
      setExpandedOrder(null);
    }
  }

  async function runOrderAction(order, action, extra) {
    if (action === 'cancel') {
      const ok = await confirm({
        title: 'Cancelar orden de pago',
        message: `Vas a cancelar la orden a "${order.payeeName}" por ${formatCurrency(order.amount, order.currency)}.`,
        confirmLabel: 'Cancelar orden',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setOrderActionError((prev) => ({ ...prev, [order.id]: '' }));
    try {
      if (action === 'submit') await paymentOrdersApi.submit(order.id);
      if (action === 'decide') await paymentOrdersApi.decide(order.id, extra);
      if (action === 'cancel') await paymentOrdersApi.cancel(order.id);
      if (expandedOrderId === order.id) {
        const full = await paymentOrdersApi.getOne(order.id);
        setExpandedOrder(full);
      }
      await loadAll();
      setCalendarData(null);
    } catch (err) {
      setOrderActionError((prev) => ({ ...prev, [order.id]: err instanceof ApiError ? err.message : 'No se pudo completar la acción.' }));
    }
  }

  // --- Lotes ---
  const [isBatchFormOpen, setIsBatchFormOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({ name: '', treasuryAccountId: '' });
  const [batchError, setBatchError] = useState('');

  async function handleCreateBatch(event) {
    event.preventDefault();
    setBatchError('');
    try {
      await paymentBatchesApi.create(batchForm);
      setBatchForm({ name: '', treasuryAccountId: '' });
      setIsBatchFormOpen(false);
      await loadAll();
    } catch (err) {
      setBatchError(err instanceof ApiError ? err.message : 'No se pudo crear el lote.');
    }
  }

  async function handleExportBatch(batch) {
    try {
      await paymentBatchesApi.export(batch.id);
      await loadAll();
    } catch {
      // se refleja al recargar
    }
  }

  if (isLoading) return <p className="text-muted">Cargando…</p>;
  if (loadError) return <p className="alert-box alert-box-error">{loadError}</p>;

  return (
    <div className="page">
      {isAdmin && (
        <div className="panel">
          <div className="panel-header">
            <h2>Reglas de aprobación</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsRuleFormOpen((v) => !v)}>
              {isRuleFormOpen ? 'Cancelar' : '+ Nueva regla'}
            </button>
          </div>
          {isRuleFormOpen && (
            <form onSubmit={handleCreateRule} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
              <div className="form-grid">
                <label className="field">
                  <span>Nombre</span>
                  <input value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} required />
                </label>
                <label className="field">
                  <span>Monto mínimo</span>
                  <input
                    type="number"
                    step="0.01"
                    value={ruleForm.minAmount}
                    onChange={(e) => setRuleForm({ ...ruleForm, minAmount: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>Monto máximo (vacío = sin tope)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={ruleForm.maxAmount}
                    onChange={(e) => setRuleForm({ ...ruleForm, maxAmount: e.target.value })}
                  />
                </label>
              </div>
              <p className="section-title field-label">
                Niveles de aprobación
                <HelpTooltip text="Cuántas personas distintas tienen que dar el visto bueno antes de que el pago se ejecute, y qué rol puede aprobar cada paso. Ej. Nivel 1: Contador, Nivel 2: Administrador — nadie puede aprobar su propia orden ni firmar dos niveles de la misma." />
              </p>
              {ruleForm.levels.map((level, i) => (
                <div key={i} className="btn-row" style={{ marginBottom: 8, alignItems: 'center' }}>
                  <span className="text-muted">Nivel {level.level}:</span>
                  {ROLES.map((role) => (
                    <label key={role} className="field field-checkbox" style={{ display: 'inline-flex' }}>
                      <input type="checkbox" checked={level.allowedRoles.includes(role)} onChange={() => toggleRole(i, role)} />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              ))}
              <button type="button" className="btn btn-small" onClick={addLevel}>
                + Agregar nivel
              </button>
              {ruleError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{ruleError}</p>}
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="submit" className="btn btn-primary">
                  Crear regla
                </button>
              </div>
            </form>
          )}
          {rules.length === 0 && <EmptyState icon="▲" message="Todavía no creaste ninguna regla de aprobación." />}
          {rules.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rango</th>
                  <th>Niveles</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>
                      {formatCurrency(r.minAmount)} — {r.maxAmount != null ? formatCurrency(r.maxAmount) : 'sin tope'}
                    </td>
                    <td>{r.levels?.length ?? 0}</td>
                    <td>
                      <StatusSeal status={r.isActive ? 'active' : 'inactive'} label={r.isActive ? 'Activa' : 'Inactiva'} />
                    </td>
                    <td>
                      {r.isActive && (
                        <button type="button" className="btn btn-small btn-danger" onClick={() => handleDeactivateRule(r)}>
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Órdenes de pago</h2>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <ViewSwitcher viewKey="treasury-payment-orders" onChange={setOrderViewMode} />
            {canManage && (
              <button type="button" className="btn btn-primary btn-small" onClick={() => setIsOrderFormOpen((v) => !v)}>
                {isOrderFormOpen ? 'Cancelar' : '+ Nueva orden'}
              </button>
            )}
          </div>
        </div>
        {canManage && isOrderFormOpen && (
          <form onSubmit={handleCreateOrder} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>Cuenta de origen</span>
                <select
                  value={orderForm.treasuryAccountId}
                  onChange={(e) => setOrderForm({ ...orderForm, treasuryAccountId: e.target.value })}
                  required
                >
                  <option value="">Selecciona una cuenta</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Cuenta contable a debitar
                  <HelpTooltip text="La cuenta de gasto o pasivo que corresponde a este pago (ej. “Gastos de Personal” si es un sueldo, o “Cuentas por Pagar” si es una factura de proveedor)." />
                </span>
                <select value={orderForm.glAccountId} onChange={(e) => setOrderForm({ ...orderForm, glAccountId: e.target.value })} required>
                  <option value="">Selecciona una cuenta</option>
                  {glAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Beneficiario</span>
                <input value={orderForm.payeeName} onChange={(e) => setOrderForm({ ...orderForm, payeeName: e.target.value })} required />
              </label>
              <label className="field">
                <span>Banco del beneficiario (opcional)</span>
                <input value={orderForm.payeeBankName} onChange={(e) => setOrderForm({ ...orderForm, payeeBankName: e.target.value })} />
              </label>
              <label className="field">
                <span>N.º de cuenta del beneficiario (opcional)</span>
                <input value={orderForm.payeeAccountNumber} onChange={(e) => setOrderForm({ ...orderForm, payeeAccountNumber: e.target.value })} />
              </label>
              <label className="field">
                <span>Monto</span>
                <input
                  type="number"
                  step="0.01"
                  value={orderForm.amount}
                  onChange={(e) => setOrderForm({ ...orderForm, amount: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Moneda (ISO)</span>
                <input
                  value={orderForm.currency}
                  onChange={(e) => setOrderForm({ ...orderForm, currency: e.target.value.toUpperCase() })}
                  maxLength={3}
                  required
                />
              </label>
              <label className="field">
                <span>Fecha programada</span>
                <input
                  type="date"
                  value={orderForm.scheduledDate}
                  onChange={(e) => setOrderForm({ ...orderForm, scheduledDate: e.target.value })}
                  required
                />
              </label>
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span>Descripción</span>
                <input value={orderForm.description} onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })} required />
              </label>
            </div>
            {orderError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{orderError}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary">
                Crear orden
              </button>
            </div>
          </form>
        )}

        {orders.length === 0 && <EmptyState icon="●" message="Todavía no creaste ninguna orden de pago." />}

        {orderViewMode === 'LIST' && orders.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Beneficiario</th>
                <th>Fecha</th>
                <th className="num">Monto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <Fragment key={o.id}>
                  <tr>
                    <td>{o.payeeName}</td>
                    <td>{formatDate(new Date(o.scheduledDate))}</td>
                    <td className="num">{formatCurrency(o.amount, o.currency)}</td>
                    <td>
                      <StatusSeal tone={STATUS_SEAL_TONE[o.status]} label={STATUS_LABELS[o.status]} />
                    </td>
                    <td>
                      <div className="btn-row">
                        <button type="button" className="btn btn-small" onClick={() => toggleOrderExpand(o)}>
                          {expandedOrderId === o.id ? 'Ocultar' : 'Ver detalle'}
                        </button>
                        {canManage && o.status === 'DRAFT' && (
                          <button type="button" className="btn btn-small" onClick={() => runOrderAction(o, 'submit')}>
                            Enviar a aprobación
                          </button>
                        )}
                        {canManage && (o.status === 'DRAFT' || o.status === 'PENDING_APPROVAL') && (
                          <button type="button" className="btn btn-small btn-danger" onClick={() => runOrderAction(o, 'cancel')}>
                            Cancelar
                          </button>
                        )}
                      </div>
                      {orderActionError[o.id] && (
                        <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                          {orderActionError[o.id]}
                        </p>
                      )}
                    </td>
                  </tr>
                  {expandedOrderId === o.id && expandedOrder && (
                    <tr>
                      <td colSpan={5}>
                        <OrderApprovalDetail order={o} expandedOrder={expandedOrder} canApprove={canApprove} runOrderAction={runOrderAction} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}

        {orderViewMode === 'KANBAN' && orders.length > 0 && (
          <div className="kanban-board">
            {KANBAN_COLUMNS.map((status) => {
              const columnOrders = orders.filter((o) => o.status === status);
              return (
                <div key={status} className="kanban-column">
                  <div className="kanban-column-header">
                    <StatusSeal tone={STATUS_SEAL_TONE[status]} label={STATUS_LABELS[status]} />
                    <span className="text-muted">{columnOrders.length}</span>
                  </div>
                  {columnOrders.length === 0 && <p className="text-muted kanban-column-empty">Sin órdenes</p>}
                  {columnOrders.map((o) => (
                    <div key={o.id} className="kanban-card" onClick={() => toggleOrderExpand(o)}>
                      <p className="kanban-card-title">{o.payeeName}</p>
                      <p className="kanban-card-amount">{formatCurrency(o.amount, o.currency)}</p>
                      <p className="text-muted">{formatDate(new Date(o.scheduledDate))}</p>
                      {expandedOrderId === o.id && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <OrderApprovalDetail order={o} expandedOrder={expandedOrder} canApprove={canApprove} runOrderAction={runOrderAction} />
                          <div className="btn-row" style={{ marginTop: 8 }}>
                            {canManage && o.status === 'DRAFT' && (
                              <button type="button" className="btn btn-small" onClick={() => runOrderAction(o, 'submit')}>
                                Enviar a aprobación
                              </button>
                            )}
                            {canManage && (o.status === 'DRAFT' || o.status === 'PENDING_APPROVAL') && (
                              <button type="button" className="btn btn-small btn-danger" onClick={() => runOrderAction(o, 'cancel')}>
                                Cancelar
                              </button>
                            )}
                          </div>
                          {orderActionError[o.id] && (
                            <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                              {orderActionError[o.id]}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {orderViewMode === 'CALENDAR' && (
          <div>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Próximas 4 semanas. Ubica cada documento con vencimiento real que representa un pago (facturas de
              compra, cuotas de deuda, órdenes de pago) en su fecha. La previsión de caja es semanal, no día a día
              — se resalta toda la semana cuyo saldo proyectado al final quedaría en negativo, y cada día con
              <strong> concentración alta de pagos</strong> se marca aparte para que se note de un vistazo.
            </p>
            {isCalendarLoading && <p className="text-muted">Cargando calendario de pagos…</p>}
            {!isCalendarLoading && calendarError && <p className="alert-box alert-box-error">{calendarError}</p>}
            {!isCalendarLoading && !calendarError && calendarData && (
              <div className="payment-calendar">
                {calendarData.weeks.map((week) => {
                  const weekStart = new Date(week.weekStart);
                  const isAtRisk = Number(week.projectedBalance) < 0;
                  const days = Array.from({ length: 7 }).map((_, i) => {
                    const day = new Date(weekStart);
                    day.setUTCDate(day.getUTCDate() + i);
                    return day;
                  });
                  return (
                    <div key={week.weekStart} className={`payment-calendar-week${isAtRisk ? ' is-at-risk' : ''}`}>
                      {isAtRisk && (
                        <p className="alert-box alert-box-error" style={{ marginBottom: 8 }}>
                          ⚠ El saldo de caja proyectado al final de esta semana sería {formatCurrency(week.projectedBalance)} —
                          no alcanzaría para cubrir los pagos programados.
                        </p>
                      )}
                      <div className="payment-calendar-days">
                        {days.map((day) => {
                          const dayKey = utcDateKey(day);
                          const dayDocuments = calendarData.documents.filter((doc) => utcDateKey(doc.date) === dayKey);
                          const isHighConcentration = calendarData.highConcentrationDates.includes(dayKey);
                          return (
                            <div key={dayKey} className={`payment-calendar-day${isHighConcentration ? ' has-high-concentration' : ''}`}>
                              <p className="payment-calendar-day-label">
                                {WEEKDAY_LABELS[day.getUTCDay()]} {day.getUTCDate()}
                                {isHighConcentration && (
                                  <span className="payment-calendar-concentration-badge" title="Concentración alta de pagos este día">
                                    ● alta
                                  </span>
                                )}
                              </p>
                              {dayDocuments.map((doc) => (
                                <Link
                                  key={doc.id}
                                  to={doc.link}
                                  className={`payment-calendar-order payment-calendar-order--${doc.type.toLowerCase()}`}
                                  title={DOCUMENT_TYPE_LABELS[doc.type]}
                                >
                                  <span>{doc.label}</span>
                                  <span className="text-muted">{formatCurrency(doc.amount)}</span>
                                </Link>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!isCalendarLoading && !calendarError && calendarData && (
              <p className="text-muted" style={{ marginTop: 8 }}>
                {calendarData.note}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Lotes de pago</h2>
          {isAdmin && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsBatchFormOpen((v) => !v)}>
              {isBatchFormOpen ? 'Cancelar' : '+ Nuevo lote'}
            </button>
          )}
        </div>
        {isAdmin && isBatchFormOpen && (
          <form onSubmit={handleCreateBatch} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} required />
              </label>
              <label className="field">
                <span>Cuenta</span>
                <select value={batchForm.treasuryAccountId} onChange={(e) => setBatchForm({ ...batchForm, treasuryAccountId: e.target.value })} required>
                  <option value="">Selecciona una cuenta</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {batchError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{batchError}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary">
                Crear lote
              </button>
            </div>
          </form>
        )}
        {batches.length === 0 && <EmptyState icon="○" message="Todavía no creaste ningún lote de pago." />}
        {batches.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>
                    <StatusSeal
                      status={b.status === 'EXPORTED' ? 'active' : b.status === 'OPEN' ? 'pending' : 'cancelled'}
                      label={b.status === 'OPEN' ? 'Abierto' : b.status === 'EXPORTED' ? 'Exportado' : 'Cancelado'}
                    />
                  </td>
                  <td>
                    {isAdmin && b.status === 'OPEN' && (
                      <button type="button" className="btn btn-small" onClick={() => handleExportBatch(b)}>
                        Exportar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
