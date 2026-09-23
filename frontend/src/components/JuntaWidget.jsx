import { useCallback, useEffect, useState } from 'react';
import { juntaApi } from '../api/junta';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/format';
import HelpTooltip from './HelpTooltip';
import EmptyState from '../core/ui/EmptyState';
import './JuntaWidget.css';

const TOPIC_LABELS = {
  INVENTORY: 'Inventario',
  ACCOUNTING: 'Contabilidad',
  PROJECTIONS: 'Proyecciones',
  GENERAL: 'General',
};

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const COMPACT_COUNT = 5;

export default function JuntaWidget() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [markingId, setMarkingId] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [topic, setTopic] = useState('GENERAL');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [messagesData, unreadData] = await Promise.all([
        juntaApi.listMessages(),
        isAdmin ? juntaApi.unreadCount() : Promise.resolve({ count: 0 }),
      ]);
      setMessages(messagesData);
      setUnreadCount(unreadData.count);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la Junta.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(event) {
    event.preventDefault();
    setUploadError('');
    if (!selectedFile) {
      setUploadError('Adjunta un archivo (PDF, imagen o Excel).');
      return;
    }
    setIsUploading(true);
    try {
      const fileContentBase64 = await readFileAsBase64(selectedFile);
      await juntaApi.createMessage({
        message,
        topic,
        fileName: selectedFile.name,
        fileMimeType: selectedFile.type || 'application/octet-stream',
        fileSizeBytes: selectedFile.size,
        fileContentBase64,
      });
      setMessage('');
      setTopic('GENERAL');
      setSelectedFile(null);
      setIsFormOpen(false);
      await load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleMarkAsRead(msg) {
    setMarkingId(msg.id);
    try {
      await juntaApi.markAsRead(msg.id);
      await load();
    } catch {
      // el error se refleja simplemente en que el mensaje sigue sin marcar
    } finally {
      setMarkingId(null);
    }
  }

  const visibleMessages = showAll ? messages : messages.slice(0, COMPACT_COUNT);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Junta
          {isAdmin && unreadCount > 0 && <span className="junta-unread-badge">{unreadCount} sin leer</span>}
          <HelpTooltip text="Un espacio para que Contador, Financiero y Colaborador te manden un mensaje corto con un archivo adjunto (PDF, imagen o Excel) como reporte de trabajo." />
        </h2>
        <div className="btn-row">
          {messages.length > COMPACT_COUNT && (
            <button type="button" className="btn btn-small" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Ver menos' : 'Ver todos'}
            </button>
          )}
          {!isAdmin && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nuevo reporte'}
            </button>
          )}
        </div>
      </div>

      {isFormOpen && !isAdmin && (
        <form onSubmit={handleUpload} className="form-grid" style={{ marginBottom: 16 }}>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Mensaje</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              required
              maxLength={2000}
            />
          </label>
          <label className="field">
            <span>Tema</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              {Object.entries(TOPIC_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Archivo (PDF, imagen o Excel)</span>
            <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} required />
          </label>
          {uploadError && (
            <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
              {uploadError}
            </p>
          )}
          <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn btn-primary btn-small" disabled={isUploading}>
              {isUploading ? 'Enviando…' : 'Enviar reporte'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-muted">Cargando…</p>}
      {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
      {!isLoading && !loadError && messages.length === 0 && (
        <EmptyState
          icon="✉"
          message={isAdmin ? 'Todavía no llegó ningún reporte.' : 'Todavía no enviaste ningún reporte.'}
        />
      )}
      {!isLoading && !loadError && messages.length > 0 && (
        <ul className="junta-list">
          {visibleMessages.map((msg) => (
            <li key={msg.id} className={`junta-item${!msg.isRead ? ' junta-item-unread' : ''}`}>
              <div className="junta-item-main">
                <p className="junta-item-message">{msg.message}</p>
                <p className="junta-item-meta">
                  {msg.sender.name} · {TOPIC_LABELS[msg.topic] || msg.topic} · {formatDate(new Date(msg.createdAt))} ·{' '}
                  <span className="junta-item-file">{msg.fileName}</span>
                </p>
              </div>
              {isAdmin && !msg.isRead && (
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={markingId === msg.id}
                  onClick={() => handleMarkAsRead(msg)}
                >
                  {markingId === msg.id ? 'Marcando…' : 'Marcar como leído'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
