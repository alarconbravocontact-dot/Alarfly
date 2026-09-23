import { useCallback, useEffect, useMemo, useState } from 'react';
import { physicalCountsApi, warehousesApi, productsApi } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const STATUS_LABELS = { DRAFT: 'Borrador', PENDING_APPROVAL: 'Pendiente de aprobación', APPROVED: 'Aprobado', REJECTED: 'Rechazado' };
const STATUS_SEAL_TONE = { DRAFT: 'neutral', PENDING_APPROVAL: 'warning', APPROVED: 'positive', REJECTED: 'negative' };

export default function PhysicalCountsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';
  const canApprove = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [counts, setCounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [warehouseId, setWarehouseId] = useState('');
  const [startError, setStartError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [expandedCount, setExpandedCount] = useState(null);
  const [editedLines, setEditedLines] = useState({});
  const [actionError, setActionError] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const variantMap = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      for (const v of p.variants) map.set(v.id, `${v.sku} · ${p.name}`);
    }
    return map;
  }, [products]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [countsData, warehousesData, productsData] = await Promise.all([
        physicalCountsApi.list(),
        warehousesApi.list({ isActive: true }),
        productsApi.list({ isActive: true }),
      ]);
      setCounts(countsData);
      setWarehouses(warehousesData);
      setProducts(productsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los conteos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleStart(event) {
    event.preventDefault();
    setStartError('');
    setIsStarting(true);
    try {
      await physicalCountsApi.start({ warehouseId });
      setWarehouseId('');
      await loadAll();
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'No se pudo iniciar el conteo.');
    } finally {
      setIsStarting(false);
    }
  }

  async function toggleExpand(count) {
    if (expandedId === count.id) {
      setExpandedId(null);
      setExpandedCount(null);
      return;
    }
    setExpandedId(count.id);
    try {
      const full = await physicalCountsApi.getOne(count.id);
      setExpandedCount(full);
      const initial = {};
      for (const line of full.lines) initial[line.id] = line.countedQuantity;
      setEditedLines(initial);
    } catch {
      setExpandedCount(null);
    }
  }

  async function handleSubmitCount(count) {
    setActionError((prev) => ({ ...prev, [count.id]: '' }));
    try {
      const lines = expandedCount.lines.map((l) => ({
        variantId: l.variantId,
        countedQuantity: Number(editedLines[l.id] ?? l.countedQuantity),
      }));
      await physicalCountsApi.submit(count.id, lines);
      await loadAll();
      setExpandedId(null);
      setExpandedCount(null);
    } catch (err) {
      setActionError((prev) => ({ ...prev, [count.id]: err instanceof ApiError ? err.message : 'No se pudo enviar el conteo.' }));
    }
  }

  async function handleApprove(count) {
    const ok = await confirm({
      title: 'Aprobar conteo',
      message: 'Vas a aprobar este conteo. Se generarán los ajustes de inventario necesarios para las diferencias encontradas.',
      confirmLabel: 'Aprobar',
    });
    if (!ok) return;
    setActionError((prev) => ({ ...prev, [count.id]: '' }));
    try {
      await physicalCountsApi.approve(count.id);
      await loadAll();
    } catch (err) {
      setActionError((prev) => ({ ...prev, [count.id]: err instanceof ApiError ? err.message : 'No se pudo aprobar el conteo.' }));
    }
  }

  async function handleReject(count) {
    setActionError((prev) => ({ ...prev, [count.id]: '' }));
    if (!rejectionReason.trim()) {
      setActionError((prev) => ({ ...prev, [count.id]: 'Debes indicar el motivo del rechazo.' }));
      return;
    }
    try {
      await physicalCountsApi.reject(count.id, rejectionReason);
      setRejectingId(null);
      setRejectionReason('');
      await loadAll();
    } catch (err) {
      setActionError((prev) => ({ ...prev, [count.id]: err instanceof ApiError ? err.message : 'No se pudo rechazar el conteo.' }));
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Iniciar conteo físico
              <HelpTooltip text="Toma una foto del stock actual del almacén elegido. Después editas la cantidad real que contaste, la envías, y otra persona distinta debe aprobarla para que se generen los ajustes." />
            </h2>
          </div>
          <form onSubmit={handleStart} className="btn-row" style={{ alignItems: 'center' }}>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="">Selecciona un almacén</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-small" disabled={isStarting}>
              {isStarting ? 'Iniciando…' : 'Iniciar conteo'}
            </button>
          </form>
          {startError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{startError}</p>}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Conteos</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && counts.length === 0 && (
          <EmptyState icon="□" message="Todavía no iniciaste ningún conteo físico." />
        )}
        {!isLoading && !loadError && counts.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Almacén</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.id}>
                  <td>{c.warehouse.name}</td>
                  <td>{formatDate(new Date(c.createdAt))}</td>
                  <td>
                    <StatusSeal tone={STATUS_SEAL_TONE[c.status]} label={STATUS_LABELS[c.status]} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => toggleExpand(c)}>
                      {expandedId === c.id ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {expandedCount && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
            <p className="section-title">
              Conteo — {expandedCount.warehouse.name} ({STATUS_LABELS[expandedCount.status]})
            </p>
            {expandedCount.rejectionReason && (
              <p className="alert-box alert-box-error" style={{ marginBottom: 12 }}>
                Rechazado: {expandedCount.rejectionReason}
              </p>
            )}
            {expandedCount.lines.length === 0 && <EmptyState icon="○" message="Este almacén no tenía existencias al iniciar el conteo." />}
            {expandedCount.lines.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Cantidad en sistema</th>
                    <th className="num">Cantidad contada</th>
                    <th className="num">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedCount.lines.map((l) => {
                    const countedValue = editedLines[l.id] ?? l.countedQuantity;
                    const difference = Number(countedValue) - Number(l.systemQuantity);
                    return (
                      <tr key={l.id}>
                        <td>{variantMap.get(l.variantId) || l.variantId}</td>
                        <td className="num">{l.systemQuantity}</td>
                        <td className="num">
                          {expandedCount.status === 'DRAFT' && canManage ? (
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={countedValue}
                              onChange={(e) => setEditedLines((prev) => ({ ...prev, [l.id]: e.target.value }))}
                              style={{ width: 100, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}
                            />
                          ) : (
                            l.countedQuantity
                          )}
                        </td>
                        <td className="num" style={{ color: difference !== 0 ? 'var(--color-warning)' : undefined }}>
                          {difference}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {actionError[expandedCount.id] && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {actionError[expandedCount.id]}
              </p>
            )}

            <div className="btn-row" style={{ marginTop: 12 }}>
              {expandedCount.status === 'DRAFT' && canManage && (
                <button type="button" className="btn btn-primary btn-small" onClick={() => handleSubmitCount(expandedCount)}>
                  Enviar conteo
                </button>
              )}
              {expandedCount.status === 'PENDING_APPROVAL' && canApprove && (
                <>
                  <button type="button" className="btn btn-primary btn-small" onClick={() => handleApprove(expandedCount)}>
                    Aprobar
                  </button>
                  {rejectingId !== expandedCount.id && (
                    <button type="button" className="btn btn-small btn-danger" onClick={() => setRejectingId(expandedCount.id)}>
                      Rechazar
                    </button>
                  )}
                  {rejectingId === expandedCount.id && (
                    <>
                      <input
                        placeholder="Motivo del rechazo"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px' }}
                      />
                      <button type="button" className="btn btn-small btn-danger" onClick={() => handleReject(expandedCount)}>
                        Confirmar rechazo
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
