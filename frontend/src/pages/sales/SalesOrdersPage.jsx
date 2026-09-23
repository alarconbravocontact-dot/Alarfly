import { Fragment, useCallback, useEffect, useState } from 'react';
import { salesOrdersApi } from '../../api/sales';
import { customersApi } from '../../api/ar';
import { productsApi, warehousesApi } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import EntityAutocomplete from '../../core/ui/EntityAutocomplete';

const STATUS_LABELS = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  PARTIALLY_DELIVERED: 'Entregado parcialmente',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};
const STATUS_TONE = {
  DRAFT: 'inactive',
  CONFIRMED: 'active',
  PARTIALLY_DELIVERED: 'warning',
  DELIVERED: 'positive',
  CANCELLED: 'negative',
};

function emptyLine() {
  return { variantId: '', warehouseId: '', description: '', quantity: 1, unitPrice: '' };
}

export default function SalesOrdersPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';
  const confirm = useConfirm();

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [variants, setVariants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [rowErrors, setRowErrors] = useState({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [ordersData, customersData, productsData, warehousesData] = await Promise.all([
        salesOrdersApi.list(),
        customersApi.list({ isActive: true }),
        productsApi.list({ isActive: true }),
        warehousesApi.list({ isActive: true }),
      ]);
      setOrders(ordersData);
      setCustomers(customersData);
      setVariants(
        productsData.flatMap((p) => (p.variants || []).filter((v) => v.isActive).map((v) => ({ id: v.id, sku: v.sku, productName: p.name, isService: p.isService })))
      );
      setWarehouses(warehousesData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los pedidos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateLine(index, changes) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...changes } : l)));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await salesOrdersApi.create({
        customerId,
        orderDate: toIsoDate(new Date()),
        lines: lines.map((l) => {
          const variant = variants.find((v) => v.id === l.variantId);
          return {
            description: l.description || (variant ? `${variant.productName} (${variant.sku})` : 'Producto'),
            variantId: l.variantId || undefined,
            warehouseId: variant && !variant.isService ? l.warehouseId || undefined : undefined,
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice),
          };
        }),
      });
      setCustomerId('');
      setLines([emptyLine()]);
      setIsFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el pedido.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmOrder(order) {
    setRowErrors((prev) => ({ ...prev, [order.id]: '' }));
    try {
      await salesOrdersApi.confirm(order.id);
      await load();
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [order.id]: err instanceof ApiError ? err.message : 'No se pudo confirmar el pedido.' }));
    }
  }

  async function handleCancelOrder(order) {
    const ok = await confirm({
      title: 'Cancelar pedido',
      message: `Vas a cancelar el pedido N.º ${order.orderNumber}. Si tenía stock reservado, se libera. Esto no se puede deshacer.`,
      confirmLabel: 'Cancelar pedido',
      tone: 'danger',
    });
    if (!ok) return;
    const reason = window.prompt('Motivo de la cancelación:');
    if (!reason) return;
    setRowErrors((prev) => ({ ...prev, [order.id]: '' }));
    try {
      await salesOrdersApi.cancel(order.id, reason);
      await load();
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [order.id]: err instanceof ApiError ? err.message : 'No se pudo cancelar el pedido.' }));
    }
  }

  async function toggleExpand(order) {
    if (expandedId === order.id) {
      setExpandedId(null);
      setExpandedOrder(null);
      return;
    }
    setExpandedId(order.id);
    try {
      const full = await salesOrdersApi.getOne(order.id);
      setExpandedOrder(full);
    } catch {
      setExpandedOrder(null);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>
          Pedidos <HelpTooltip text="Un pedido es la intención de venta, antes de entregar y facturar. Es opcional: para una venta simple puedes usar Venta Rápida o facturar directo." />
        </h2>
        {canManage && (
          <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
            {isFormOpen ? 'Cancelar' : '+ Nuevo pedido'}
          </button>
        )}
      </div>

      {canManage && isFormOpen && (
        <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
          <label className="field">
            <span>Cliente</span>
            <EntityAutocomplete
              entityType="customer"
              items={customers}
              getId={(c) => c.id}
              getLabel={(c) => c.name}
              getSearchText={(c) => c.name}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Buscar cliente…"
              required
            />
          </label>

          <div style={{ gridColumn: '1 / -1' }}>
            {lines.map((line, index) => {
              const variant = variants.find((v) => v.id === line.variantId);
              return (
                <div key={index} className="btn-row" style={{ alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap' }}>
                  <label className="field" style={{ minWidth: 220 }}>
                    <span>Producto</span>
                    <EntityAutocomplete
                      entityType="product"
                      items={variants}
                      getId={(v) => v.id}
                      getLabel={(v) => `${v.productName} (${v.sku})${v.isService ? ' — servicio' : ''}`}
                      getSearchText={(v) => `${v.productName} ${v.sku}`}
                      value={line.variantId}
                      onChange={(id) => updateLine(index, { variantId: id })}
                      placeholder="Buscar producto…"
                    />
                  </label>
                  {variant && !variant.isService && (
                    <label className="field" style={{ width: 160 }}>
                      <span>Almacén</span>
                      <select value={line.warehouseId} onChange={(e) => updateLine(index, { warehouseId: e.target.value })} required>
                        <option value="">Elige uno</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="field" style={{ width: 90 }}>
                    <span>Cantidad</span>
                    <input type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} required />
                  </label>
                  <label className="field" style={{ width: 110 }}>
                    <span>Precio</span>
                    <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} required />
                  </label>
                  {lines.length > 1 && (
                    <button type="button" className="btn btn-small" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                      Quitar
                    </button>
                  )}
                </div>
              );
            })}
            <button type="button" className="btn btn-small" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
              + Agregar línea
            </button>
          </div>

          {formError && (
            <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
              {formError}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>
            {isSaving ? 'Creando…' : 'Crear pedido'}
          </button>
        </form>
      )}

      {isLoading && <p className="text-muted">Cargando…</p>}
      {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
      {!isLoading && !loadError && orders.length === 0 && <EmptyState icon="●" message="Todavía no hay pedidos." />}
      {!isLoading && !loadError && orders.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>N.º</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Estado</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <Fragment key={order.id}>
                <tr>
                  <td>{order.orderNumber}</td>
                  <td>{order.customer?.name}</td>
                  <td>{formatDate(new Date(order.orderDate))}</td>
                  <td>
                    <StatusSeal status={STATUS_TONE[order.status]} label={STATUS_LABELS[order.status]} />
                  </td>
                  {canManage && (
                    <td>
                      <div className="btn-row">
                        <button type="button" className="btn btn-small" onClick={() => toggleExpand(order)}>
                          {expandedId === order.id ? 'Ocultar' : 'Ver'}
                        </button>
                        {order.status === 'DRAFT' && (
                          <button type="button" className="btn btn-small btn-primary" onClick={() => handleConfirmOrder(order)}>
                            Confirmar
                          </button>
                        )}
                        {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                          <button type="button" className="btn btn-small btn-danger" onClick={() => handleCancelOrder(order)}>
                            Cancelar
                          </button>
                        )}
                      </div>
                      {rowErrors[order.id] && (
                        <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                          {rowErrors[order.id]}
                        </p>
                      )}
                    </td>
                  )}
                </tr>
                {expandedId === order.id && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Descripción</th>
                            <th className="num">Cantidad</th>
                            <th className="num">Entregado</th>
                            <th className="num">Facturado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(expandedOrder?.lines || []).map((line) => (
                            <tr key={line.id}>
                              <td>{line.description}</td>
                              <td className="num">{line.quantity}</td>
                              <td className="num">{line.deliveredQuantity}</td>
                              <td className="num">{line.invoicedQuantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
