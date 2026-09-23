import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventoryMovementsApi, productsApi, unitsOfMeasureApi, warehousesApi } from '../../api/inventory';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';
import EntityAutocomplete from '../../core/ui/EntityAutocomplete';
import QuickCreateModal from '../../core/ui/QuickCreateModal';
import { recentlyUsedApi } from '../../api/recently-used';

const MOVEMENT_TYPE_LABELS = {
  PURCHASE_ENTRY: 'Entrada por compra',
  PRODUCTION_ENTRY: 'Entrada por producción',
  SALE_EXIT: 'Salida por venta',
  CONSUMPTION_EXIT: 'Salida por consumo',
  TRANSFER_OUT: 'Transferencia (salida)',
  TRANSFER_IN: 'Transferencia (entrada)',
  ADJUSTMENT_INCREASE: 'Ajuste (incremento)',
  ADJUSTMENT_DECREASE: 'Ajuste (decremento)',
  PHYSICAL_COUNT_ADJUSTMENT: 'Ajuste por conteo físico',
};

export default function MovementsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [mode, setMode] = useState('entry');
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [unitsOfMeasure, setUnitsOfMeasure] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [quickCreateProductTerm, setQuickCreateProductTerm] = useState(null);
  const [productFlashKey, setProductFlashKey] = useState(null);

  const [variantId, setVariantId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [counterpartyAccountId, setCounterpartyAccountId] = useState('');
  const [direction, setDirection] = useState('INCREASE');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const variants = useMemo(
    () => products.flatMap((p) => p.variants.map((v) => ({ id: v.id, label: `${v.sku} · ${p.name}` }))),
    [products]
  );

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [movementsData, productsData, warehousesData, accountsData, unitsData] = await Promise.all([
        inventoryMovementsApi.list(),
        productsApi.list({ isActive: true }),
        warehousesApi.list({ isActive: true }),
        accountsApi.list({ isActive: true }),
        unitsOfMeasureApi.list(),
      ]);
      setMovements(movementsData);
      setProducts(productsData);
      setWarehouses(warehousesData);
      setAccounts(accountsData.filter((a) => a.isPostable));
      setUnitsOfMeasure(unitsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los movimientos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function resetForm() {
    setVariantId('');
    setWarehouseId('');
    setQuantity('');
    setUnitCost('');
    setCounterpartyAccountId('');
    setReason('');
    setNotes('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      if (mode === 'entry') {
        await inventoryMovementsApi.createEntry({
          variantId,
          warehouseId,
          quantity: Number(quantity),
          unitCost: Number(unitCost),
          date,
          counterpartyAccountId,
          notes: notes || undefined,
        });
      } else if (mode === 'exit') {
        await inventoryMovementsApi.createExit({
          variantId,
          warehouseId,
          quantity: Number(quantity),
          date,
          notes: notes || undefined,
        });
      } else {
        await inventoryMovementsApi.createAdjustment({
          variantId,
          warehouseId,
          direction,
          quantity: Number(quantity),
          unitCost: direction === 'INCREASE' ? Number(unitCost) : undefined,
          reason,
          date,
        });
      }
      resetForm();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar el movimiento.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2>Registrar movimiento</h2>
          </div>
          <div className="module-tabs" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={`module-tab${mode === 'entry' ? ' is-active' : ''}`}
              onClick={() => setMode('entry')}
            >
              Entrada
            </button>
            <button
              type="button"
              className={`module-tab${mode === 'exit' ? ' is-active' : ''}`}
              onClick={() => setMode('exit')}
            >
              Salida
            </button>
            <button
              type="button"
              className={`module-tab${mode === 'adjustment' ? ' is-active' : ''}`}
              onClick={() => setMode('adjustment')}
            >
              Ajuste
            </button>
          </div>

          <form onSubmit={handleSubmit} className="form-grid">
            <label className="field">
              <span>Producto / variante</span>
              <EntityAutocomplete
                entityType="product"
                items={variants}
                getId={(v) => v.id}
                getLabel={(v) => v.label}
                getSearchText={(v) => v.label}
                value={variantId}
                onChange={(id) => setVariantId(id)}
                onCreateNew={(term) => setQuickCreateProductTerm(term)}
                createLabel="producto"
                placeholder="Buscar producto o variante…"
                flashKey={productFlashKey}
                required
              />
            </label>
            <label className="field">
              <span>Almacén</span>
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
              <span>Cantidad</span>
              <input type="number" step="0.0001" min="0.0001" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </label>
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>

            {mode === 'entry' && (
              <>
                <label className="field">
                  <span>Costo unitario</span>
                  <input type="number" step="0.000001" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required />
                </label>
                <label className="field">
                  <span className="field-label">
                    Cuenta contrapartida
                    <HelpTooltip text="La cuenta contable de dónde viene este inventario (ej. Bancos si se pagó de contado, o Cuentas por Pagar si fue a crédito)." />
                  </span>
                  <select value={counterpartyAccountId} onChange={(e) => setCounterpartyAccountId(e.target.value)} required>
                    <option value="">Selecciona una cuenta</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {mode === 'adjustment' && (
              <>
                <label className="field">
                  <span>Dirección</span>
                  <select value={direction} onChange={(e) => setDirection(e.target.value)}>
                    <option value="INCREASE">Incremento (sobrante)</option>
                    <option value="DECREASE">Decremento (faltante)</option>
                  </select>
                </label>
                {direction === 'INCREASE' && (
                  <label className="field">
                    <span>Costo unitario</span>
                    <input type="number" step="0.000001" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required />
                  </label>
                )}
                <label className="field" style={{ gridColumn: 'span 2' }}>
                  <span>Motivo</span>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Merma encontrada en bodega" required />
                </label>
              </>
            )}

            {mode !== 'adjustment' && (
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span>Notas (opcional)</span>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            )}

            {formError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Registrar movimiento'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Movimientos registrados</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && movements.length === 0 && (
          <EmptyState icon="○" message="Todavía no hay movimientos de inventario registrados." />
        )}
        {!isLoading && !loadError && movements.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Almacén</th>
                <th className="num">Cantidad</th>
                <th className="num">Costo unitario</th>
                <th className="num">Costo total</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(new Date(m.date))}</td>
                  <td>{MOVEMENT_TYPE_LABELS[m.type] || m.type}</td>
                  <td>
                    {m.variant.sku} · {m.variant.product.name}
                  </td>
                  <td>{m.warehouse.name}</td>
                  <td className="num">{m.quantity}</td>
                  <td className="num">{formatCurrency(m.unitCost)}</td>
                  <td className="num">{formatCurrency(m.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {quickCreateProductTerm !== null && (
        <QuickCreateModal
          title="Crear producto"
          fields={[
            { key: 'name', label: 'Nombre', type: 'text', required: true, autoFocus: true },
            { key: 'sku', label: 'SKU', type: 'text', required: true },
            {
              key: 'baseUnitOfMeasureId',
              label: 'Unidad de medida',
              type: 'select',
              required: true,
              options: unitsOfMeasure.map((u) => ({ value: u.id, label: `${u.code} · ${u.name}` })),
            },
          ]}
          initialValues={{ name: quickCreateProductTerm }}
          onSubmit={(values) => productsApi.create(values)}
          onSuccess={(created) => {
            setProducts((prev) => [...prev, created]);
            const defaultVariantId = created.variants[0].id;
            setVariantId(defaultVariantId);
            setProductFlashKey(defaultVariantId);
            setQuickCreateProductTerm(null);
            recentlyUsedApi.record('product', defaultVariantId).catch(() => {});
          }}
          onCancel={() => setQuickCreateProductTerm(null)}
        />
      )}
    </div>
  );
}
