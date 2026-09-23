import { useCallback, useEffect, useState } from 'react';
import { apCreditNotesApi, vendorsApi, apBillsApi } from '../../api/ap';
import { productsApi, warehousesApi } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import EntityAutocomplete from '../../core/ui/EntityAutocomplete';

export default function ApCreditNotesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [notes, setNotes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [variants, setVariants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [vendorId, setVendorId] = useState('');
  const [vendorBills, setVendorBills] = useState([]);
  const [billId, setBillId] = useState('');
  const [type, setType] = useState('CREDIT');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  // Fase 4 (punto 29 — integración mínima de devoluciones a proveedor):
  // opcional, solo cuando la nota SÍ representa mercancía que vuelve
  // físicamente al proveedor — genera una salida real de inventario.
  const [hasPhysicalReturn, setHasPhysicalReturn] = useState(false);
  const [returnVariantId, setReturnVariantId] = useState('');
  const [returnWarehouseId, setReturnWarehouseId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [notesData, vendorsData, productsData, warehousesData] = await Promise.all([
        apCreditNotesApi.list(),
        vendorsApi.list({ isActive: true }),
        productsApi.list({ isActive: true }),
        warehousesApi.list({ isActive: true }),
      ]);
      setNotes(notesData);
      setVendors(vendorsData);
      setVariants(
        productsData.flatMap((p) => (p.variants || []).filter((v) => v.isActive && !p.isService).map((v) => ({ id: v.id, sku: v.sku, productName: p.name })))
      );
      setWarehouses(warehousesData);
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
    if (!vendorId) {
      setVendorBills([]);
      return;
    }
    apBillsApi
      .list({ vendorId })
      .then((data) => setVendorBills(data.filter((b) => b.status !== 'CANCELLED')))
      .catch(() => setVendorBills([]));
  }, [vendorId]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    if (hasPhysicalReturn && (!returnVariantId || !returnWarehouseId || !returnQuantity)) {
      setFormError('Indica producto, almacén y cantidad de la devolución física.');
      return;
    }
    setIsSaving(true);
    try {
      await apCreditNotesApi.create({
        billId,
        type,
        reason,
        amount: Number(amount),
        date,
        physicalReturn: hasPhysicalReturn
          ? { productVariantId: returnVariantId, warehouseId: returnWarehouseId, quantity: Number(returnQuantity) }
          : undefined,
      });
      setBillId('');
      setReason('');
      setAmount('');
      setHasPhysicalReturn(false);
      setReturnVariantId('');
      setReturnWarehouseId('');
      setReturnQuantity('');
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
              <HelpTooltip text="Nota de crédito: reduce lo que le debes al proveedor (ej. una devolución). Nota de débito: aumenta lo que le debes (ej. un cargo adicional). Siempre queda ligada a la factura original." />
            </h2>
          </div>
          <form onSubmit={handleCreate} className="form-grid">
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
              <span>Factura</span>
              <select value={billId} onChange={(e) => setBillId(e.target.value)} required disabled={!vendorId}>
                <option value="">Selecciona una factura</option>
                {vendorBills.map((bill) => (
                  <option key={bill.id} value={bill.id}>
                    N.º {bill.billNumber} — total {formatCurrency(bill.totalAmount)}
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
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Devolución de mercancía defectuosa" required />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={hasPhysicalReturn} onChange={(e) => setHasPhysicalReturn(e.target.checked)} />
              <span className="field-label" style={{ margin: 0 }}>
                Esta nota corresponde a una devolución física de mercancía
                <HelpTooltip text="Si marcas esto, además del ajuste contable se genera una salida real de inventario — la mercancía sale del almacén de verdad." />
              </span>
            </label>
            {hasPhysicalReturn && (
              <>
                <label className="field">
                  <span>Producto devuelto</span>
                  <EntityAutocomplete
                    entityType="product"
                    items={variants}
                    getId={(v) => v.id}
                    getLabel={(v) => `${v.productName} (${v.sku})`}
                    getSearchText={(v) => `${v.productName} ${v.sku}`}
                    value={returnVariantId}
                    onChange={setReturnVariantId}
                    placeholder="Buscar producto…"
                  />
                </label>
                <label className="field">
                  <span>Almacén</span>
                  <select value={returnWarehouseId} onChange={(e) => setReturnWarehouseId(e.target.value)}>
                    <option value="">Elige uno</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Cantidad devuelta</span>
                  <input type="number" min="0.0001" step="0.0001" value={returnQuantity} onChange={(e) => setReturnQuantity(e.target.value)} />
                </label>
              </>
            )}

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
          <EmptyState icon="□" message="Todavía no registraste ninguna nota de crédito ni débito a proveedor." />
        )}
        {!isLoading && !loadError && notes.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>N.º</th>
                <th>Proveedor</th>
                <th>Factura</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th className="num">Monto</th>
                <th>Fecha</th>
                <th>Devolución física</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id}>
                  <td>{n.noteNumber}</td>
                  <td>{n.vendor.name}</td>
                  <td>N.º {n.bill.billNumber}</td>
                  <td>
                    <StatusSeal
                      status={n.type === 'CREDIT' ? 'active' : 'pending'}
                      label={n.type === 'CREDIT' ? 'Crédito' : 'Débito'}
                    />
                  </td>
                  <td>{n.reason}</td>
                  <td className="num">{formatCurrency(n.amount)}</td>
                  <td>{formatDate(new Date(n.date))}</td>
                  <td>{n.relatedInventoryMovementId ? 'Sí' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
