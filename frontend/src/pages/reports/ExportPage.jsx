import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportExportApi } from '../../api/reports';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate, toIsoDate, currentMonthRange } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const REPORT_TYPES = [
  { value: 'income-statement', label: 'Estado de Resultados', needsRange: true },
  { value: 'balance-sheet', label: 'Balance General', needsRange: false },
  { value: 'cash-flow', label: 'Flujo de Efectivo', needsRange: true },
  { value: 'profitability-products', label: 'Rentabilidad por Producto', needsRange: true },
  { value: 'profitability-clients', label: 'Rentabilidad por Cliente', needsRange: true },
];
const FREQUENCY_LABELS = { DAILY: 'Diaria', WEEKLY: 'Semanal', MONTHLY: 'Mensual' };

const { from: defaultFrom, to: defaultTo } = currentMonthRange();

export default function ExportPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const [searchParams] = useSearchParams();

  const [reportType, setReportType] = useState(searchParams.get('reportType') || 'income-statement');
  const [format, setFormat] = useState('pdf');
  const [from, setFrom] = useState(searchParams.get('from') || defaultFrom);
  const [to, setTo] = useState(searchParams.get('to') || defaultTo);
  const [asOfDate, setAsOfDate] = useState(toIsoDate(new Date()));
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [scheduled, setScheduled] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Al llegar desde "Programar envío recurrente" de una pantalla de
  // reporte (ej. Flujo de Efectivo), el tipo y el rango de fechas que
  // el usuario ya tenía elegido viajan en la URL — así no tiene que
  // volver a configurarlos acá para programar exactamente lo que
  // estaba viendo.
  const [isFormOpen, setIsFormOpen] = useState(searchParams.get('schedule') === '1');
  const [schedType, setSchedType] = useState(searchParams.get('reportType') || 'income-statement');
  const [schedFormat, setSchedFormat] = useState('pdf');
  const [schedFrequency, setSchedFrequency] = useState('MONTHLY');
  const [schedRecipients, setSchedRecipients] = useState('');
  const [schedFormError, setSchedFormError] = useState('');
  const [runError, setRunError] = useState({});

  const needsRange = REPORT_TYPES.find((r) => r.value === reportType)?.needsRange;

  const loadScheduled = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setScheduled(await reportExportApi.listScheduled());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los reportes programados.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  async function handleExport() {
    setExportError('');
    setIsExporting(true);
    try {
      const params = needsRange ? { from, to } : { asOfDate };
      await reportExportApi.download(reportType, format, params);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'No se pudo generar el archivo.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleCreateScheduled(event) {
    event.preventDefault();
    setSchedFormError('');
    const recipients = schedRecipients
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      setSchedFormError('Indica al menos un correo destinatario.');
      return;
    }
    const needsSchedRange = REPORT_TYPES.find((r) => r.value === schedType)?.needsRange;
    try {
      await reportExportApi.createScheduled({
        reportType: schedType,
        frequency: schedFrequency,
        recipients,
        parameters: needsSchedRange ? { format: schedFormat, from, to } : { format: schedFormat, asOfDate },
      });
      setSchedRecipients('');
      setIsFormOpen(false);
      await loadScheduled();
    } catch (err) {
      setSchedFormError(err instanceof ApiError ? err.message : 'No se pudo programar el reporte.');
    }
  }

  async function handleToggleActive(item) {
    if (item.isActive) {
      const ok = await confirm({
        title: 'Desactivar reporte programado',
        message: `Vas a desactivar el envío programado de "${item.reportType}".`,
        confirmLabel: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await reportExportApi.updateScheduled(item.id, { isActive: !item.isActive });
      await loadScheduled();
    } catch {
      // se refleja al recargar
    }
  }

  async function handleDelete(item) {
    const ok = await confirm({
      title: 'Eliminar reporte programado',
      message: `Vas a eliminar el reporte programado "${item.reportType}". Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await reportExportApi.deleteScheduled(item.id);
      await loadScheduled();
    } catch {
      // se refleja al recargar
    }
  }

  async function handleRunNow(item) {
    setRunError((prev) => ({ ...prev, [item.id]: '' }));
    try {
      await reportExportApi.runScheduled(item.id);
      await loadScheduled();
    } catch (err) {
      setRunError((prev) => ({ ...prev, [item.id]: err instanceof ApiError ? err.message : 'No se pudo generar el reporte.' }));
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Exportar un reporte</h2>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Reporte</span>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Formato</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
          </label>
          {needsRange ? (
            <>
              <label className="field">
                <span>Desde</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          ) : (
            <label className="field">
              <span>Al día</span>
              <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            </label>
          )}
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Generando…' : 'Descargar'}
          </button>
        </div>
        {exportError && (
          <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
            {exportError}
          </p>
        )}
      </div>

      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Reportes programados
              <HelpTooltip text="Genera el archivo del reporte automáticamente según la frecuencia elegida y deja constancia de cuándo se generó. Por ahora no envía el correo automáticamente — se puede descargar con “Generar ahora”." />
            </h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Programar reporte'}
            </button>
          </div>

          {isFormOpen && (
            <form onSubmit={handleCreateScheduled} className="form-grid" style={{ marginBottom: 16 }}>
              <label className="field">
                <span>Reporte</span>
                <select value={schedType} onChange={(e) => setSchedType(e.target.value)}>
                  {REPORT_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Formato</span>
                <select value={schedFormat} onChange={(e) => setSchedFormat(e.target.value)}>
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </label>
              <label className="field">
                <span>Frecuencia</span>
                <select value={schedFrequency} onChange={(e) => setSchedFrequency(e.target.value)}>
                  <option value="DAILY">Diaria</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </label>
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span className="field-label">
                  Destinatarios
                  <HelpTooltip text="Uno o varios correos separados por coma. Por ahora el envío por correo no está implementado — el reporte queda listo para descargar con “Generar ahora”." />
                </span>
                <input value={schedRecipients} onChange={(e) => setSchedRecipients(e.target.value)} placeholder="correo@empresa.com, otro@empresa.com" required />
              </label>
              {schedFormError && (
                <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                  {schedFormError}
                </p>
              )}
              <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-primary btn-small">
                  Programar
                </button>
              </div>
            </form>
          )}

          {isLoading && <p className="text-muted">Cargando…</p>}
          {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
          {!isLoading && !loadError && scheduled.length === 0 && (
            <EmptyState icon="◷" message="Todavía no programaste ningún reporte." />
          )}
          {!isLoading && !loadError && scheduled.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reporte</th>
                  <th>Frecuencia</th>
                  <th>Destinatarios</th>
                  <th>Última generación</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {scheduled.map((item) => (
                  <tr key={item.id}>
                    <td>{REPORT_TYPES.find((r) => r.value === item.reportType)?.label || item.reportType}</td>
                    <td>{FREQUENCY_LABELS[item.frequency] || item.frequency}</td>
                    <td>{item.recipients.join(', ')}</td>
                    <td>{item.lastRunAt ? formatDate(new Date(item.lastRunAt)) : '—'}</td>
                    <td>
                      <StatusSeal status={item.isActive ? 'active' : 'inactive'} label={item.isActive ? 'Activo' : 'Inactivo'} />
                    </td>
                    <td>
                      <div className="btn-row">
                        <button type="button" className="btn btn-small" onClick={() => handleRunNow(item)}>
                          Generar ahora
                        </button>
                        <button type="button" className="btn btn-small" onClick={() => handleToggleActive(item)}>
                          {item.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button type="button" className="btn btn-small btn-danger" onClick={() => handleDelete(item)}>
                          Eliminar
                        </button>
                      </div>
                      {runError[item.id] && <p className="alert-box alert-box-error" style={{ marginTop: 4 }}>{runError[item.id]}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
