import { useCallback, useEffect, useMemo, useState } from 'react';
import { purchaseOrdersApi, warehousesApi, productsApi } from '../../api/inventory';
import { vendorsApi } from '../../api/ap';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const STATUS_LABELS = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviada',
  PARTIALLY_RECEIVED: 'Recibida parcial',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
};
const STATUS_SEAL_TONE = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'positive',
  CANCELLED: 'negative',
};

function emptyLine() {
  return { variantId: '', quantityOrdered: '', unitCost: '' };
}

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [orderDate, setOrderDate] = useState(toIsoDate(new Date()));
  const [lines, setLines] = useState([emptyLine()]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [scanMessage, setScanMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [actionError, setActionError] = useState({});
  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveDate, setReceiveDate] = useState(toIsoDate(new Date()));
  const [receiveAccountId, setReceiveAccountId] = useState('');
  const [receiveQuantities, setReceiveQuantities] = useState({});

  const variantMap = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      for (const v of p.variants) map.set(v.id, `${v.sku} · ${p.name}`);
    }
    return map;
  }, [products]);

  const variants = useMemo(
    () => products.flatMap((p) => p.variants.map((v) => ({ id: v.id, label: `${v.sku} · ${p.name}` }))),
    [products]
  );

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [ordersData, warehousesData, productsData, vendorsData, accountsData] = await Promise.all([
        purchaseOrdersApi.list(),
        warehousesApi.list({ isActive: true }),
        productsApi.list({ isActive: true }),
        vendorsApi.list({ isActive: true }),
        accountsApi.list({ isActive: true }),
      ]);
      setOrders(ordersData);
      setWarehouses(warehousesData);
      setProducts(productsData);
      setVendors(vendorsData);
      setAccounts(accountsData.filter((a) => a.isPostable));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las órdenes de compra.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function updateLine(index, changes) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...changes } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await purchaseOrdersApi.create({
        vendorId: vendorId || undefined,
        warehouseId,
        orderDate,
        lines: lines.map((l) => ({
          variantId: l.variantId,
          quantityOrdered: Number(l.quantityOrdered),
          unitCost: l.unitCost === '' ? undefined : Number(l.unitCost),
        })),
      });
      setLines([emptyLine()]);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la orden de compra.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleScan() {
    setIsScanning(true);
    setScanMessage('');
    try {
      const result = await purchaseOrdersApi.scan();
      setScanMessage(
        `Se generaron ${result.purchaseOrdersGenerated.length} orden(es) de compra automáticas y ${result.totalAlertsCreated} alerta(s) nuevas.`
      );
      await loadAll();
    } catch (err) {
      setScanMessage(err instanceof ApiError ? err.message : 'No se pudo escanear el stock bajo.');
    } finally {
      setIsScanning(false);
    }
  }

  async function toggleExpand(order) {
    if (expandedId === order.id) {
      setExpandedId(null);
      setExpandedOrder(null);
      setIsReceiving(false);
      return;
    }
    setExpandedId(order.id);
    setIsReceiving(false);
    try {
      const full = await purchaseOrdersApi.getOne(order.id);
      setExpandedOrder(full);
    } catch {
      setExpandedOrder(null);
    }
  }

  async function handleSubmitOrder(order) {
    setActionError((prev) => ({ ...prev, [order.id]: '' }));
    try {
      await purchaseOrdersApi.submit(order.id);
      await loadAll();
      const full = await purchaseOrdersApi.getOne(order.id);
      setExpandedOrder(full);
    } catch (err) {
      setActionError((prev) => ({ ...prev, [order.id]: err instanceof ApiError ? err.message : 'No se pudo enviar la orden.' }));
    }
  }

  async function handleCancelOrder(order) {
    const ok = await confirm({
      title: 'Cancelar orden de compra',
      message: `Vas a cancelar la orden de "${order.warehouse.name}". Esto no se puede deshacer.`,
      confirmLabel: 'Cancelar orden',
      tone: 'danger',
    });
    if (!ok) return;
    setActionError((prev) => ({ ...prev, [order.id]: '' }));
    try {
      await purchaseOrdersApi.cancel(order.id);
      await loadAll();
      setExpandedId(null);
      setExpandedOrder(null);
    } catch (err) {
      setActionError((prev) => ({ ...prev, [order.id]: err instanceof ApiError ? err.message : 'No se pudo cancelar la orden.' }));
    }
  }

  async function handleReceive(order) {
    setActionError((prev) => ({ ...prev, [order.id]: '' }));
    const receipts = expandedOrder.lines
      .filter((l) => receiveQuantities[l.id])
      .map((l) => ({ lineId: l.id, quantityReceived: Number(receiveQuantities[l.id]) }));
    if (receipts.length === 0) {
      setActionError((prev) => ({ ...prev, [order.id]: 'Indica la cantidad recibida de al menos una línea.' }));
      return;
    }
    try {
      await purchaseOrdersApi.receive(order.id, { date: receiveDate, counterpartyAccountId: receiveAccountId, receipts });
      setIsReceiving(false);
      setReceiveQuantities({});
      await loadAll();
      const full = await purchaseOrdersApi.getOne(order.id);
      setExpandedOrder(full);
    } catch (err) {
      setActionError((prev) => ({ ...prev, [order.id]: err instanceof ApiError ? err.message : 'No se pudo recibir la orden.' }));
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Crear orden de compra
              <HelpTooltip text="El sistema también puede generar órdenes de compra borrador solas, cuando un producto baja de su stock mínimo — usa el botón “Escanear stock bajo”." />
            </h2>
            <button type="button" className="btn btn-small" onClick={handleScan} disabled={isScanning}>
              {isScanning ? 'Escaneando…' : 'Escanear stock bajo'}
            </button>
          </div>
          {scanMessage && <p className="alert-box alert-box-success" style={{ marginBottom: 16 }}>{scanMessage}</p>}
          <form onSubmit={handleCreate}>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <label className="field">
                <span>Proveedor (opcional)</span>
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  <option value="">Sin proveedor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Almacén de destino</span>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                  <option value="">Selecciona un almacén</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Fecha</span>
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
              </label>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto / variante</th>
                  <th>Cantidad</th>
                  <th className="num">Costo estimado (opcional)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td>
                      <select value={line.variantId} onChange={(e) => updateLine(index, { variantId: e.target.value })} required>
                        <option value="">Selecciona una variante</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={line.quantityOrdered}
                        onChange={(e) => updateLine(index, { quantityOrdered: e.target.value })}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={line.unitCost}
                        onChange={(e) => updateLine(index, { unitCost: e.target.value })}
                      />
                    </td>
                    <td>
                      {lines.length > 1 && (
                        <button type="button" className="btn btn-small btn-danger" onClick={() => removeLine(index)}>
                          Quitar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-small" onClick={addLine}>
                + Agregar línea
              </button>
            </div>
            {formError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear orden'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Órdenes de compra</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && orders.length === 0 && (
          <EmptyState icon="●" message="Todavía no creaste ninguna orden de compra." />
        )}
        {!isLoading && !loadError && orders.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Almacén</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.vendor?.name || '—'}</td>
                  <td>{o.warehouse.name}</td>
                  <td>{formatDate(new Date(o.orderDate))}</td>
                  <td>
                    <StatusSeal tone={STATUS_SEAL_TONE[o.status]} label={STATUS_LABELS[o.status]} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => toggleExpand(o)}>
                      {expandedId === o.id ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {expandedOrder && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
            <p className="section-title">
              Orden — {expandedOrder.warehouse.name} ({STATUS_LABELS[expandedOrder.status]})
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Pedido</th>
                  <th className="num">Recibido</th>
                  <th className="num">Costo estimado</th>
                  {isReceiving && <th className="num">Recibir ahora</th>}
                </tr>
              </thead>
              <tbody>
                {expandedOrder.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{variantMap.get(l.variantId) || l.variantId}</td>
                    <td className="num">{l.quantityOrdered}</td>
                    <td className="num">{l.quantityReceived}</td>
                    <td className="num">{l.unitCost != null ? formatCurrency(l.unitCost) : '—'}</td>
                    {isReceiving && (
                      <td className="num">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={receiveQuantities[l.id] || ''}
                          onChange={(e) => setReceiveQuantities((prev) => ({ ...prev, [l.id]: e.target.value }))}
                          style={{ width: 90, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {isReceiving && (
              <div className="form-grid" style={{ marginTop: 12 }}>
                <label className="field">
                  <span>Fecha de recepción</span>
                  <input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">
                    Cuenta contrapartida
                    <HelpTooltip text="La cuenta contable de dónde viene esta compra (ej. Cuentas por Pagar si fue a crédito, o Bancos si se pagó de contado)." />
                  </span>
                  <select value={receiveAccountId} onChange={(e) => setReceiveAccountId(e.target.value)} required>
                    <option value="">Selecciona una cuenta</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {actionError[expandedOrder.id] && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {actionError[expandedOrder.id]}
              </p>
            )}

            <div className="btn-row" style={{ marginTop: 12 }}>
              {canManage && expandedOrder.status === 'DRAFT' && (
                <button type="button" className="btn btn-primary btn-small" onClick={() => handleSubmitOrder(expandedOrder)}>
                  Enviar orden
                </button>
              )}
              {canManage && (expandedOrder.status === 'SUBMITTED' || expandedOrder.status === 'PARTIALLY_RECEIVED') && !isReceiving && (
                <button type="button" className="btn btn-primary btn-small" onClick={() => setIsReceiving(true)}>
                  Recibir mercancía
                </button>
              )}
              {isReceiving && (
                <>
                  <button type="button" className="btn btn-primary btn-small" onClick={() => handleReceive(expandedOrder)}>
                    Confirmar recepción
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => setIsReceiving(false)}>
                    Cancelar
                  </button>
                </>
              )}
              {canManage && expandedOrder.status !== 'RECEIVED' && expandedOrder.status !== 'CANCELLED' && !isReceiving && (
                <button type="button" className="btn btn-small btn-danger" onClick={() => handleCancelOrder(expandedOrder)}>
                  Cancelar orden
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
