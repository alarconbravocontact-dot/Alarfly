import { useEffect, useState } from 'react';
import { liquidityForecastApi } from '../../api/treasury';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';

export default function LiquidityForecastPage() {
  const [weeks, setWeeks] = useState(8);
  const [forecast, setForecast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(weeksToLoad) {
    setIsLoading(true);
    setError('');
    try {
      const data = await liquidityForecastApi.get(weeksToLoad);
      setForecast(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la previsión de liquidez.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load(weeks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Previsión de Liquidez
            <HelpTooltip text="Una proyección de cuánto dinero vas a tener disponible semana a semana, sumando el saldo actual más lo que se espera cobrar (facturas de clientes) y restando lo que se espera pagar (facturas de proveedores, cuotas de deuda, pagos programados)." />
          </h2>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span>Semanas</span>
              <input
                type="number"
                min={1}
                max={52}
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))}
                style={{
                  width: 70,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 9px',
                }}
              />
            </label>
            <button type="button" className="btn btn-primary btn-small" onClick={() => load(weeks)}>
              Recalcular
            </button>
          </div>
        </div>

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && error && <p className="alert-box alert-box-error">{error}</p>}

        {!isLoading && !error && forecast && (
          <>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Saldo inicial: {formatCurrency(forecast.startingBalance)}. {forecast.note}
            </p>
            {forecast.firstNegativeWeek && (
              <p className="alert-box alert-box-error" style={{ marginBottom: 12 }}>
                El saldo proyectado se vuelve negativo en la semana del {formatDate(new Date(forecast.firstNegativeWeek.weekStart))}.
              </p>
            )}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th className="num">Entradas esperadas</th>
                  <th className="num">Salidas esperadas</th>
                  <th className="num">Cambio neto</th>
                  <th className="num">Saldo proyectado</th>
                </tr>
              </thead>
              <tbody>
                {forecast.weeks.map((w, i) => (
                  <tr key={i}>
                    <td>
                      {formatDate(new Date(w.weekStart))} — {formatDate(new Date(w.weekEnd))}
                    </td>
                    <td className="num">{formatCurrency(w.expectedInflows)}</td>
                    <td className="num">{formatCurrency(w.expectedOutflows)}</td>
                    <td className="num">{formatCurrency(w.netChange)}</td>
                    <td className="num">
                      <strong style={{ color: Number(w.projectedBalance) < 0 ? 'var(--color-negative)' : undefined }}>
                        {formatCurrency(w.projectedBalance)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
