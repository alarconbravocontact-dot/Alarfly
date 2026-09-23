import { useCallback, useEffect, useState } from 'react';
import { fiscalDocumentsApi, fiscalTransactionsApi } from '../../api/fiscal';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';

const FILE_TYPE_LABELS = { PDF: 'PDF', XML: 'XML', OTHER: 'Otro' };

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FiscalDocumentsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN';

  const [documents, setDocuments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [filters, setFilters] = useState({ counterparty: '', from: '', to: '', fileType: '' });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [uploadTransactionId, setUploadTransactionId] = useState('');
  const [uploadFileType, setUploadFileType] = useState('PDF');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [deleteError, setDeleteError] = useState({});

  const search = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const documentsData = await fiscalDocumentsApi.search({
        counterparty: filters.counterparty || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        fileType: filters.fileType || undefined,
      });
      setDocuments(documentsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los documentos.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    fiscalTransactionsApi.list().then(setTransactions).catch(() => setTransactions([]));
  }, []);

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(event) {
    event.preventDefault();
    setUploadError('');
    if (!selectedFile) {
      setUploadError('Selecciona un archivo.');
      return;
    }
    setIsUploading(true);
    try {
      const content = await readFileAsBase64(selectedFile);
      await fiscalDocumentsApi.upload({
        fiscalTransactionId: uploadTransactionId,
        fileType: uploadFileType,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
        content,
      });
      setUploadTransactionId('');
      setSelectedFile(null);
      setIsFormOpen(false);
      await search();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'No se pudo subir el documento.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(doc) {
    setDeleteError((prev) => ({ ...prev, [doc.id]: '' }));
    const ok = await confirm({
      title: 'Eliminar documento',
      message: `Vas a eliminar "${doc.fileName}". Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await fiscalDocumentsApi.remove(doc.id);
      await search();
    } catch (err) {
      setDeleteError((prev) => ({ ...prev, [doc.id]: err instanceof ApiError ? err.message : 'No se pudo eliminar el documento.' }));
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Documentos digitales
              <HelpTooltip text="El respaldo digital (PDF, XML u otro archivo) de cada venta o compra fiscal — por ejemplo, la factura escaneada o el comprobante que envió el proveedor de facturación electrónica." />
            </h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Subir documento'}
            </button>
          </div>
          {isFormOpen && (
            <form onSubmit={handleUpload} className="form-grid">
              <label className="field">
                <span>Transacción fiscal</span>
                <select value={uploadTransactionId} onChange={(e) => setUploadTransactionId(e.target.value)} required>
                  <option value="">Selecciona una transacción</option>
                  {transactions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatDate(new Date(t.date))} · {t.counterpartyName} · {t.type === 'SALE' ? 'Venta' : 'Compra'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tipo de archivo</span>
                <select value={uploadFileType} onChange={(e) => setUploadFileType(e.target.value)}>
                  <option value="PDF">PDF</option>
                  <option value="XML">XML</option>
                  <option value="OTHER">Otro</option>
                </select>
              </label>
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span>Archivo</span>
                <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} required />
              </label>
              {uploadError && (
                <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                  {uploadError}
                </p>
              )}
              <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-primary btn-small" disabled={isUploading}>
                  {isUploading ? 'Subiendo…' : 'Subir documento'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Buscar documentos</h2>
        </div>
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <label className="field">
            <span>Cliente o proveedor</span>
            <input
              value={filters.counterparty}
              onChange={(e) => setFilters({ ...filters, counterparty: e.target.value })}
              placeholder="Nombre o NIT/RFC"
            />
          </label>
          <label className="field">
            <span>Tipo de archivo</span>
            <select value={filters.fileType} onChange={(e) => setFilters({ ...filters, fileType: e.target.value })}>
              <option value="">Todos</option>
              <option value="PDF">PDF</option>
              <option value="XML">XML</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>
          <label className="field">
            <span>Desde</span>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </label>
          <div className="btn-row" style={{ alignItems: 'flex-end' }}>
            <button type="button" className="btn btn-primary btn-small" onClick={search}>
              Buscar
            </button>
          </div>
        </div>

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && documents.length === 0 && (
          <EmptyState icon="⎘" message="No se encontraron documentos con estos filtros." />
        )}
        {!isLoading && !loadError && documents.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Tipo</th>
                <th>Transacción</th>
                <th>Contraparte</th>
                <th>Fecha</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.fileName}</td>
                  <td>{FILE_TYPE_LABELS[doc.fileType] || doc.fileType}</td>
                  <td>{doc.fiscalTransaction.documentNumber || (doc.fiscalTransaction.type === 'SALE' ? 'Venta' : 'Compra')}</td>
                  <td>{doc.fiscalTransaction.counterpartyName}</td>
                  <td>{formatDate(new Date(doc.fiscalTransaction.date))}</td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => handleDelete(doc)}>
                        Eliminar
                      </button>
                      {deleteError[doc.id] && <p className="alert-box alert-box-error" style={{ marginTop: 4 }}>{deleteError[doc.id]}</p>}
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
