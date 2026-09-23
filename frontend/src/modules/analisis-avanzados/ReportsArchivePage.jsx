import { Fragment, useEffect, useState } from 'react';
import { analysisCatalogApi, analysisReportsApi } from '../../api/advanced-analytics';
import { ApiError } from '../../api/client';
import { formatDate } from '../../utils/format';
import EmptyState from '../../core/ui/EmptyState';
import StatusSeal from '../../core/ui/StatusSeal';
import AnalysisResultView from './AnalysisResultView';

export default function ReportsArchivePage() {
  const [catalog, setCatalog] = useState([]);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedReport, setExpandedReport] = useState(null);

  const [filterType, setFilterType] = useState('');
  const [filterTrigger, setFilterTrigger] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    analysisCatalogApi.list().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  function load() {
    setIsLoading(true);
    setLoadError('');
    analysisReportsApi
      .list({ analysisType: filterType || undefined, triggerSource: filterTrigger || undefined, from: filterFrom || undefined, to: filterTo || undefined })
      .then(setReports)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los reportes archivados.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [filterType, filterTrigger, filterFrom, filterTo]);

  function labelFor(analysisType) {
    return catalog.find((c) => c.analysisType === analysisType)?.label || analysisType;
  }

  async function toggleExpand(report) {
    if (expandedId === report.id) {
      setExpandedId(null);
      setExpandedReport(null);
      return;
    }
    setExpandedId(report.id);
    const full = await analysisReportsApi.getOne(report.id);
    setExpandedReport(full);
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">Filtrar reportes archivados</h2>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Tipo de análisis</span>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Todos</option>
              {catalog.map((c) => (
                <option key={c.analysisType} value={c.analysisType}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Origen</span>
            <select value={filterTrigger} onChange={(e) => setFilterTrigger(e.target.value)}>
              <option value="">Todos</option>
              <option value="MANUAL">Manual</option>
              <option value="AUTOMATIC">Automático</option>
            </select>
          </label>
          <label className="field">
            <span>Desde</span>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="panel">
        {isLoading && <p className="text-muted">Cargando…</p>}
        {loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && reports.length === 0 && (
          <EmptyState message="Todavía no hay reportes archivados con estos filtros — ejecuta un análisis desde el Catálogo." />
        )}
        {!isLoading && reports.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Análisis</th>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Quién lo generó</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <Fragment key={report.id}>
                  <tr>
                    <td>{labelFor(report.analysisType)}</td>
                    <td>{formatDate(new Date(report.createdAt))}</td>
                    <td>
                      <StatusSeal status={report.triggerSource === 'AUTOMATIC' ? 'active' : 'pending'} label={report.triggerSource === 'AUTOMATIC' ? 'Automático' : 'Manual'} />
                    </td>
                    <td>{report.triggeredByUser?.name || '—'}</td>
                    <td>
                      <div className="btn-row">
                        <button type="button" className="btn btn-small" onClick={() => toggleExpand(report)}>
                          {expandedId === report.id ? 'Cerrar' : 'Abrir'}
                        </button>
                        <button type="button" className="btn btn-small" onClick={() => analysisReportsApi.export(report.id, 'pdf')}>
                          PDF
                        </button>
                        <button type="button" className="btn btn-small" onClick={() => analysisReportsApi.export(report.id, 'excel')}>
                          Excel
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === report.id && expandedReport && (
                    <tr>
                      <td colSpan={5}>
                        <AnalysisResultView report={expandedReport} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
