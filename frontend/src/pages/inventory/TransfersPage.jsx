import { useCallback, useEffect, useMemo, useState } from 'react';
import { transfersApi, warehousesApi, productsApi } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';

function emptyLine() {
  return { variantId: '', quantity: '' };
}

export default function TransfersPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [lines, setLines] = useState([emptyLine()]);
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
      const [transfersData, warehousesData, productsData] = await Promise.all([
        transfersApi.list(),
        warehousesApi.list({ isActive: true }),
        productsApi.list({ isActive: true }),
      ]);
      setTransfers(transfersData);
      setWarehouses(warehousesData);
      setProducts(productsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las transferencias.');
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
    if (fromWarehouseId === toWarehouseId) {
      setFormError('El almacén de origen y destino deben ser distintos.');
      return;
    }
    setIsSaving(true);
    try {
      await transfersApi.create({
        fromWarehouseId,
        toWarehouseId,
        date,
        lines: lines.map((l) => ({ variantId: l.variantId, quantity: Number(l.quantity) })),
      });
      setLines([emptyLine()]);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar la transferencia.');
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
              Registrar transferencia
              <HelpTooltip text="Mueve stock de un almacén a otro. No genera ningún asiento contable — el valor total del inventario de la empresa no cambia, solo su ubicación." />
            </h2>
          </div>
          <form onSubmit={handleCreate}>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <label className="field">
                <span>Almacén de origen</span>
                <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} required>
                  <option value="">Selecciona un almacén</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Almacén de destino</span>
                <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required>
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
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto / variante</th>
                  <th>Cantidad</th>
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
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: e.target.value })}
                        required
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
                {isSaving ? 'Guardando…' : 'Registrar transferencia'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Transferencias registradas</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && transfers.length === 0 && (
          <EmptyState icon="○" message="Todavía no registraste ninguna transferencia." />
        )}
        {!isLoading && !loadError && transfers.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Destino</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(new Date(t.date))}</td>
                  <td>{t.fromWarehouse.name}</td>
                  <td>{t.toWarehouse.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
