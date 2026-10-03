import { useCallback, useEffect, useState } from 'react';
import { lotsApi } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';

export default function LotsPage() {
  const [lots, setLots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expiringBefore, setExpiringBefore] = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [trace, setTrace] = useState(null);
  const [traceError, setTraceError] = useState('');

  const loadLots = useCallback(async (filterDate) => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await lotsApi.list(filterDate ? { expiringBefore: filterDate } : undefined);
      setLots(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los lotes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  async function toggleExpand(lot) {
    if (expandedId === lot.id) {
      setExpandedId(null);
      setTrace(null);
      return;
    }
    setExpandedId(lot.id);
    setTraceError('');
    try {
      const data = await lotsApi.getTrace(lot.id);
      setTrace(data);
    } catch (err) {
      setTrace(null);
      setTraceError(err instanceof ApiError ? err.message : 'No se pudo cargar la trazabilidad.');
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Lotes y vencimientos
            <HelpTooltip text="Cada lote es un grupo de unidades que entró junto al inventario (útil para saber de dónde vino algo, o cuándo vence). Solo aparecen aquí los productos configurados para “rastrear lotes”." />
          </h2>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <span>Vence antes de</span>
            <input
              type="date"
              value={expiringBefore}
              onChange={(e) => {
                setExpiringBefore(e.target.value);
                loadLots(e.target.value);
              }}
            />
          </label>
        </div>

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && lots.length === 0 && (
          <EmptyState icon="□" message="Todavía no hay lotes registrados." />
        )}
        {!isLoading && !loadError && lots.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Producto</th>
                <th>Vencimiento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td>{lot.lotNumber}</td>
                  <td>
                    {lot.variant.sku} · {lot.variant.product.name}
                  </td>
                  <td>{lot.expirationDate ? formatDate(new Date(lot.expirationDate)) : 'Sin vencimiento'}</td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => toggleExpand(lot)}>
                      {expandedId === lot.id ? 'Ocultar' : 'Ver trazabilidad'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {traceError && (
          <p className="alert-box alert-box-error" style={{ marginTop: 16 }}>
            {traceError}
          </p>
        )}

        {trace && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
            <p className="section-title">
              Trazabilidad — {trace.lot.lotNumber} ({trace.variantSku} · {trace.productName})
            </p>
            {trace.exactTraceAvailable ? (
              <p className="text-muted" style={{ marginBottom: 12 }}>
                Cantidad restante: {trace.remainingQuantity}
              </p>
            ) : (
              <p className="alert-box alert-box-warning" style={{ marginBottom: 12 }}>
                No se puede saber la cantidad restante exacta de este lote: este producto usa valoración
                por Promedio Ponderado, que no distingue de qué lote salió cada venta. Para ver cuánto
                queda en total del producto, revisa el stock en la pestaña “Stock”.
              </p>
            )}

            <p className="section-title">Entradas</p>
            {trace.entries.length === 0 && <EmptyState icon="○" message="Sin entradas registradas para este lote." />}
            {trace.entries.length > 0 && (
              <table className="data-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Almacén</th>
                    <th className="num">Cantidad</th>
                    <th className="num">Costo unitario</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.entries.map((e) => (
                    <tr key={e.movementId}>
                      <td>{formatDate(new Date(e.date))}</td>
                      <td>{e.warehouseName}</td>
                      <td className="num">{e.quantity}</td>
                      <td className="num">{formatCurrency(e.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="section-title">Salidas que consumieron este lote</p>
            {trace.usages.length === 0 && trace.exactTraceAvailable && (
              <EmptyState icon="○" message="Todavía no se ha consumido nada de este lote." />
            )}
            {trace.usages.length === 0 && !trace.exactTraceAvailable && (
              <EmptyState
                icon="○"
                message="No se puede saber qué ventas/salidas consumieron este lote en particular (valoración por Promedio Ponderado)."
              />
            )}
            {trace.usages.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo de salida</th>
                    <th className="num">Cantidad consumida</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.usages.map((u, i) => (
                    <tr key={i}>
                      <td>{formatDate(new Date(u.exitDate))}</td>
                      <td>{u.exitType}</td>
                      <td className="num">{u.quantityConsumed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
