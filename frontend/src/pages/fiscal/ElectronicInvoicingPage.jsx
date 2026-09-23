import { useCallback, useEffect, useState } from 'react';
import { electronicInvoicingApi, fiscalTransactionsApi } from '../../api/fiscal';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const STATUS_LABELS = { GENERATED: 'Generado', REJECTED: 'Rechazado', CANCELLED: 'Anulado' };
const STATUS_TONE = { GENERATED: 'positive', REJECTED: 'negative', CANCELLED: 'negative' };

export default function ElectronicInvoicingPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';

  const [documents, setDocuments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [transactionId, setTransactionId] = useState('');
  const [generateError, setGenerateError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [cancellingId, setCancellingId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState({});

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [documentsData, transactionsData] = await Promise.all([electronicInvoicingApi.list(), fiscalTransactionsApi.list()]);
      setDocuments(documentsData);
      setTransactions(transactionsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los comprobantes electrónicos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleGenerate(event) {
    event.preventDefault();
    setGenerateError('');
    setIsGenerating(true);
    try {
      await electronicInvoicingApi.generate(transactionId, 'MOCK');
      setTransactionId('');
      await loadAll();
    } catch (err) {
      setGenerateError(err instanceof ApiError ? err.message : 'No se pudo generar el comprobante.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCancel(document) {
    setCancelError((prev) => ({ ...prev, [document.id]: '' }));
    if (!cancelReason.trim()) {
      setCancelError((prev) => ({ ...prev, [document.id]: 'Indica el motivo de la anulación.' }));
      return;
    }
    try {
      await electronicInvoicingApi.cancel(document.id, cancelReason);
      setCancellingId('');
      setCancelReason('');
      await loadAll();
    } catch (err) {
      setCancelError((prev) => ({ ...prev, [document.id]: err instanceof ApiError ? err.message : 'No se pudo anular el comprobante.' }));
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Generar comprobante electrónico
              <HelpTooltip text="Envía la transacción fiscal al proveedor de facturación electrónica configurado (hoy solo hay un proveedor de prueba, MOCK) para obtener el comprobante oficial. Una transacción sin NIT/RFC del receptor será rechazada por el proveedor." />
            </h2>
          </div>
          <form onSubmit={handleGenerate} className="btn-row" style={{ alignItems: 'center' }}>
            <label className="field" style={{ minWidth: 320 }}>
              <span>Transacción fiscal</span>
              <select value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required>
                <option value="">Selecciona una transacción</option>
                {transactions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formatDate(new Date(t.date))} · {t.counterpartyName} · {t.type === 'SALE' ? 'Venta' : 'Compra'}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary" disabled={isGenerating}>
              {isGenerating ? 'Generando…' : 'Generar comprobante'}
            </button>
          </form>
          {generateError && (
            <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
              {generateError}
            </p>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Comprobantes electrónicos</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && documents.length === 0 && (
          <EmptyState icon="✉" message="Todavía no generaste ningún comprobante electrónico." />
        )}
        {!isLoading && !loadError && documents.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>N.º externo</th>
                <th>Estado</th>
                <th>Detalle</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.provider}</td>
                  <td>{doc.externalDocumentId || '—'}</td>
                  <td>
                    <StatusSeal tone={STATUS_TONE[doc.status]} label={STATUS_LABELS[doc.status] || doc.status} />
                  </td>
                  <td className="text-muted">{doc.errorMessage || (doc.issuedAt ? `Emitido ${formatDate(new Date(doc.issuedAt))}` : '—')}</td>
                  {canManage && (
                    <td>
                      {doc.status === 'GENERATED' &&
                        (cancellingId === doc.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo de anulación" />
                            <button type="button" className="btn btn-small btn-danger" onClick={() => handleCancel(doc)}>
                              Confirmar
                            </button>
                            <button type="button" className="btn btn-small" onClick={() => setCancellingId('')}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="btn btn-small btn-danger" onClick={() => setCancellingId(doc.id)}>
                            Anular
                          </button>
                        ))}
                      {cancelError[doc.id] && <p className="alert-box alert-box-error" style={{ marginTop: 4 }}>{cancelError[doc.id]}</p>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
