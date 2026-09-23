import { useState } from 'react';
import { agingApi } from '../../api/reports';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';
import RecordLink from '../../core/ui/RecordLink';

const BUCKET_LABELS = {
  CURRENT: 'Al día',
  DAYS_1_30: '1 a 30 días',
  DAYS_31_60: '31 a 60 días',
  DAYS_61_90: '61 a 90 días',
  DAYS_90_PLUS: 'Más de 90 días',
};
const BUCKET_ORDER = ['CURRENT', 'DAYS_1_30', 'DAYS_31_60', 'DAYS_61_90', 'DAYS_90_PLUS'];

export default function AgingPage() {
  const [mode, setMode] = useState('receivables');
  const [asOfDate, setAsOfDate] = useState(toIsoDate(new Date()));
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      const data = mode === 'receivables' ? await agingApi.receivables(asOfDate) : await agingApi.payables(asOfDate);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar la antigüedad de saldos.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Antigüedad de Saldos
            <HelpTooltip text="Agrupa las facturas todavía pendientes de cobro o de pago según cuántos días llevan vencidas, para saber qué tan atrasada está la cartera." />
          </h2>
        </div>
        <div className="module-tabs" style={{ marginBottom: 16 }}>
          <button type="button" className={`module-tab${mode === 'receivables' ? ' is-active' : ''}`} onClick={() => setMode('receivables')}>
            Cuentas por Cobrar
          </button>
          <button type="button" className={`module-tab${mode === 'payables' ? ' is-active' : ''}`} onClick={() => setMode('payables')}>
            Cuentas por Pagar
          </button>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Al día</span>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </label>
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={isLoading}>
            {isLoading ? 'Generando…' : 'Generar'}
          </button>
        </div>
        {error && (
          <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
      </div>

      {result && (
        <>
          <div className="panel">
            <div className="panel-header">
              <h2>Totales por antigüedad</h2>
              <span className="text-hero">{formatCurrency(result.totalOutstanding)}</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  {BUCKET_ORDER.map((bucket) => (
                    <th key={bucket} className="num">
                      {BUCKET_LABELS[bucket]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {BUCKET_ORDER.map((bucket) => (
                    <td key={bucket} className="num">
                      {formatCurrency(result.totalsByBucket[bucket])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Detalle</h2>
            </div>
            {result.rows.length === 0 && <EmptyState icon="▤" message="No hay saldos pendientes a esta fecha." />}
            {result.rows.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{mode === 'receivables' ? 'Cliente' : 'Proveedor'}</th>
                    <th>Documento</th>
                    <th>Vencimiento</th>
                    <th className="num">Días de atraso</th>
                    <th>Antigüedad</th>
                    <th className="num">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <RecordLink type={mode === 'receivables' ? 'customer' : 'vendor'} id={mode === 'receivables' ? row.customerId : row.vendorId}>
                          {row.name}
                        </RecordLink>
                      </td>
                      <td>
                        {row.documentNumber ? (
                          <RecordLink type={mode === 'receivables' ? 'ar-invoice' : 'ap-bill'} id={row.id}>
                            {row.documentNumber}
                          </RecordLink>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{formatDate(new Date(row.dueDate))}</td>
                      <td className="num">{row.daysOverdue > 0 ? row.daysOverdue : 0}</td>
                      <td>{BUCKET_LABELS[row.bucket]}</td>
                      <td className="num">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!result && !isLoading && !error && (
        <div className="panel">
          <EmptyState icon="▤" message="Elige una fecha y genera para ver la antigüedad de saldos." />
        </div>
      )}
    </div>
  );
}
