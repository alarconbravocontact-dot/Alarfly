import { useCallback, useEffect, useState } from 'react';
import { lotsApi } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';
import RecordDrawer from '../../core/ui/RecordDrawer';

export default function LotsPage() {
  const [lots, setLots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expiringBefore, setExpiringBefore] = useState('');

  // Detalle contextual (drawer): consultar la trazabilidad de un lote
  // NO navega a otra pantalla ni reinicia el filtro de vencimiento —
  // cerrarlo devuelve exactamente a la misma lista.
  const [selectedLotId, setSelectedLotId] = useState(null);
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

  const selectedLot = selectedLotId ? lots.find((l) => l.id === selectedLotId) : null;
  const selectedIndex = selectedLotId ? lots.findIndex((l) => l.id === selectedLotId) : -1;

  useEffect(() => {
    if (!selectedLotId) {
      setTrace(null);
      setTraceError('');
      return;
    }
    let cancelled = false;
    setTraceError('');
    lotsApi
      .getTrace(selectedLotId)
      .then((data) => {
        if (!cancelled) setTrace(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setTrace(null);
          setTraceError(err instanceof ApiError ? err.message : 'No se pudo cargar la trazabilidad.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLotId]);

  function openLotDetail(lot) {
    setSelectedLotId(lot.id);
  }

  function closeLotDetail() {
    setSelectedLotId(null);
  }

  function navigateLotDetail(delta) {
    if (selectedIndex === -1) return;
    const next = lots[selectedIndex + delta];
    if (next) setSelectedLotId(next.id);
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
                    <button type="button" className="btn btn-small" onClick={() => openLotDetail(lot)}>
                      Ver trazabilidad
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RecordDrawer
        isOpen={Boolean(selectedLot)}
        onClose={closeLotDetail}
        title={selectedLot ? `Lote ${selectedLot.lotNumber}` : ''}
        subtitle={selectedLot ? `${selectedLot.variant.sku} · ${selectedLot.variant.product.name}` : ''}
        onNavigate={navigateLotDetail}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex !== -1 && selectedIndex < lots.length - 1}
        summary={
          <div>
            {traceError && <p className="alert-box alert-box-error">{traceError}</p>}
            {!traceError && !trace && <p className="text-muted">Cargando…</p>}
            {trace && (
              <>
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
              </>
            )}
          </div>
        }
      />
    </div>
  );
}
