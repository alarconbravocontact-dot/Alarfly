import { useCallback, useEffect, useState } from 'react';
import { salesDeliveriesApi, salesOrdersApi } from '../../api/sales';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const STATUS_LABELS = { DRAFT: 'Borrador', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' };
const STATUS_TONE = { DRAFT: 'inactive', CONFIRMED: 'positive', CANCELLED: 'negative' };

export default function SalesDeliveriesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';
  const confirm = useConfirm();

  const [deliveries, setDeliveries] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rowErrors, setRowErrors] = useState({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderDetail, setOrderDetail] = useState(null);
  const [lineQuantities, setLineQuantities] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [deliveriesData, confirmedOrders, partialOrders] = await Promise.all([
        salesDeliveriesApi.list(),
        salesOrdersApi.list({ status: 'CONFIRMED' }),
        salesOrdersApi.list({ status: 'PARTIALLY_DELIVERED' }),
      ]);
      setDeliveries(deliveriesData);
      setPendingOrders([...confirmedOrders, ...partialOrders]);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las entregas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSelectOrder(id) {
    setOrderId(id);
    setOrderDetail(null);
    setLineQuantities({});
    if (!id) return;
    try {
      const full = await salesOrdersApi.getOne(id);
      setOrderDetail(full);
      const initial = {};
      full.lines.forEach((line) => {
        const remaining = Number(line.quantity) - Number(line.deliveredQuantity);
        if (line.warehouseId && remaining > 0) initial[line.id] = remaining;
      });
      setLineQuantities(initial);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo cargar el pedido.');
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      const lines = Object.entries(lineQuantities)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([orderLineId, quantity]) => ({ orderLineId, quantity: Number(quantity) }));
      if (lines.length === 0) {
        setFormError('Indica al menos una cantidad a entregar.');
        setIsSaving(false);
        return;
      }
      await salesDeliveriesApi.create({ orderId, deliveryDate: toIsoDate(new Date()), lines });
      setOrderId('');
      setOrderDetail(null);
      setLineQuantities({});
      setIsFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la entrega.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelivery(delivery) {
    const ok = await confirm({
      title: 'Confirmar entrega',
      message: `Vas a confirmar la entrega N.º ${delivery.deliveryNumber}. Esto descuenta el inventario real y no se puede deshacer.`,
      confirmLabel: 'Confirmar entrega',
    });
    if (!ok) return;
    setRowErrors((prev) => ({ ...prev, [delivery.id]: '' }));
    try {
      await salesDeliveriesApi.confirm(delivery.id);
      await load();
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [delivery.id]: err instanceof ApiError ? err.message : 'No se pudo confirmar la entrega.' }));
    }
  }

  async function handleCancelDelivery(delivery) {
    const reason = window.prompt('Motivo de la cancelación:');
    if (!reason) return;
    setRowErrors((prev) => ({ ...prev, [delivery.id]: '' }));
    try {
      await salesDeliveriesApi.cancel(delivery.id, reason);
      await load();
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [delivery.id]: err instanceof ApiError ? err.message : 'No se pudo cancelar la entrega.' }));
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>
          Entregas <HelpTooltip text="Confirmar una entrega es el momento en que el producto sale físicamente del almacén: ahí se descuenta el inventario real y se calcula su costo. Antes de confirmar, no se ha movido nada." />
        </h2>
        {canManage && (
          <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
            {isFormOpen ? 'Cancelar' : '+ Nueva entrega'}
          </button>
        )}
      </div>

      {canManage && isFormOpen && (
        <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
          <label className="field">
            <span>Pedido</span>
            <select value={orderId} onChange={(e) => handleSelectOrder(e.target.value)} required>
              <option value="">Elige un pedido confirmado</option>
              {pendingOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  N.º {o.orderNumber} — {o.customer?.name}
                </option>
              ))}
            </select>
          </label>

          {orderDetail && (
            <div style={{ gridColumn: '1 / -1' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th className="num">Pendiente de entregar</th>
                    <th className="num">Entregar ahora</th>
                  </tr>
                </thead>
                <tbody>
                  {orderDetail.lines
                    .filter((line) => line.warehouseId)
                    .map((line) => {
                      const remaining = Number(line.quantity) - Number(line.deliveredQuantity);
                      return (
                        <tr key={line.id}>
                          <td>{line.description}</td>
                          <td className="num">{remaining}</td>
                          <td className="num">
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              step="0.0001"
                              value={lineQuantities[line.id] ?? ''}
                              onChange={(e) => setLineQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))}
                              disabled={remaining <= 0}
                              style={{ width: 90 }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {formError && (
            <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
              {formError}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={isSaving || !orderDetail} style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>
            {isSaving ? 'Creando…' : 'Crear entrega'}
          </button>
        </form>
      )}

      {isLoading && <p className="text-muted">Cargando…</p>}
      {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
      {!isLoading && !loadError && deliveries.length === 0 && <EmptyState icon="●" message="Todavía no hay entregas." />}
      {!isLoading && !loadError && deliveries.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>N.º</th>
              <th>Cliente</th>
              <th>Pedido</th>
              <th>Fecha</th>
              <th>Estado</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                <td>{delivery.deliveryNumber}</td>
                <td>{delivery.customer?.name}</td>
                <td>{delivery.order ? `N.º ${delivery.order.orderNumber}` : '—'}</td>
                <td>{formatDate(new Date(delivery.deliveryDate))}</td>
                <td>
                  <StatusSeal status={STATUS_TONE[delivery.status]} label={STATUS_LABELS[delivery.status]} />
                </td>
                {canManage && (
                  <td>
                    <div className="btn-row">
                      {delivery.status === 'DRAFT' && (
                        <>
                          <button type="button" className="btn btn-small btn-primary" onClick={() => handleConfirmDelivery(delivery)}>
                            Confirmar
                          </button>
                          <button type="button" className="btn btn-small btn-danger" onClick={() => handleCancelDelivery(delivery)}>
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                    {rowErrors[delivery.id] && (
                      <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                        {rowErrors[delivery.id]}
                      </p>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
