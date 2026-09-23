import { useState } from 'react';
import { profitabilityApi } from '../../api/reports';
import { ApiError } from '../../api/client';
import { formatCurrency, currentMonthRange } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';

const { from: defaultFrom, to: defaultTo } = currentMonthRange();

export default function ProfitabilityPage() {
  const [mode, setMode] = useState('products');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      const data = mode === 'products' ? await profitabilityApi.byProduct(from, to) : await profitabilityApi.byClient(from, to);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el reporte de rentabilidad.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Rentabilidad por Producto o Cliente
            <HelpTooltip text="Compara el ingreso directo de cada producto o cliente contra su costo directo, más una parte proporcional de los costos que no se pueden atribuir a ninguno en particular (costo indirecto, repartido según la participación de cada uno en el ingreso)." />
          </h2>
        </div>
        <div className="module-tabs" style={{ marginBottom: 16 }}>
          <button type="button" className={`module-tab${mode === 'products' ? ' is-active' : ''}`} onClick={() => setMode('products')}>
            Por producto
          </button>
          <button type="button" className={`module-tab${mode === 'clients' ? ' is-active' : ''}`} onClick={() => setMode('clients')}>
            Por cliente
          </button>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Desde</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
              <h2>Detalle</h2>
              <span className="text-muted">Costo indirecto del periodo: {formatCurrency(result.totalIndirectCost)}</span>
            </div>
            {result.rows.length === 0 && <EmptyState icon="▤" message="No hay ingresos etiquetados en este rango de fechas." />}
            {result.rows.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{mode === 'products' ? 'Producto' : 'Cliente'}</th>
                    <th className="num">Ingreso directo</th>
                    <th className="num">Costo directo</th>
                    <th className="num">Margen de contribución</th>
                    <th className="num">Costo indirecto asignado</th>
                    <th className="num">Margen neto</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.dimensionId}>
                      <td>{row.dimensionName}</td>
                      <td className="num">{formatCurrency(row.directRevenue)}</td>
                      <td className="num">{formatCurrency(row.directCost)}</td>
                      <td className="num">
                        {formatCurrency(row.contributionMargin)}
                        {row.contributionMarginPercent !== null && (
                          <span className="text-muted"> ({row.contributionMarginPercent}%)</span>
                        )}
                      </td>
                      <td className="num">{formatCurrency(row.indirectCostAllocated)}</td>
                      <td className="num">
                        {formatCurrency(row.netMargin)}
                        {row.netMarginPercent !== null && <span className="text-muted"> ({row.netMarginPercent}%)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Más y menos rentables</h2>
            </div>
            <div className="form-grid">
              <div>
                <p className="text-muted" style={{ marginBottom: 8 }}>
                  Los 5 más rentables
                </p>
                {result.mostProfitable.map((row) => (
                  <p key={row.dimensionId}>
                    {row.dimensionName} — <strong>{formatCurrency(row.netMargin)}</strong>
                  </p>
                ))}
              </div>
              <div>
                <p className="text-muted" style={{ marginBottom: 8 }}>
                  Los 5 menos rentables
                </p>
                {result.leastProfitable.map((row) => (
                  <p key={row.dimensionId}>
                    {row.dimensionName} — <strong>{formatCurrency(row.netMargin)}</strong>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {!result && !isLoading && !error && (
        <div className="panel">
          <EmptyState icon="▤" message="Elige un rango de fechas y genera para ver la rentabilidad." />
        </div>
      )}
    </div>
  );
}
