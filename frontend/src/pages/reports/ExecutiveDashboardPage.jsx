import { useCallback, useEffect, useState } from 'react';
import { executiveDashboardApi } from '../../api/reports';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate, toIsoDate, currentMonthRange } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatCard from '../../components/StatCard';
import EmptyState from '../../core/ui/EmptyState';

const { from: defaultFrom, to: defaultTo } = currentMonthRange();

function WidgetContent({ widgetKey, data }) {
  if (widgetKey === 'cash_position') {
    return (
      <StatCard
        label="Posición de caja consolidada"
        value={formatCurrency(data.totalInBaseCurrency, data.baseCurrency)}
        hint={`Colchón de liquidez: ${formatCurrency(data.liquidityCushion, data.baseCurrency)}`}
      />
    );
  }
  if (widgetKey === 'ebitda') {
    return <StatCard label="EBITDA" value={formatCurrency(data.ebitda)} hint={`Utilidad neta: ${formatCurrency(data.netIncome)}`} />;
  }
  if (widgetKey === 'burn_rate_runway') {
    const isBurning = Number(data.monthlyBurnRate) > 0;
    return (
      <StatCard
        label="Burn Rate y Runway"
        value={formatCurrency(data.monthlyBurnRate)}
        hint={data.runwayMonths ? `Runway: ${data.runwayMonths} meses` : 'La operación no está consumiendo caja.'}
        tone={isBurning ? 'negative' : 'positive'}
      />
    );
  }
  if (widgetKey === 'income_statement_summary') {
    return (
      <table className="data-table">
        <tbody>
          <tr>
            <td>Ingresos</td>
            <td className="num">{formatCurrency(data.totalIncome)}</td>
          </tr>
          <tr>
            <td>Gastos</td>
            <td className="num">{formatCurrency(data.totalExpense)}</td>
          </tr>
          <tr>
            <td>
              <strong>Utilidad neta</strong>
            </td>
            <td className="num">
              <strong>{formatCurrency(data.netIncome)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }
  if (widgetKey === 'balance_sheet_summary') {
    return (
      <table className="data-table">
        <tbody>
          <tr>
            <td>Total Activos</td>
            <td className="num">{formatCurrency(data.totalAssets)}</td>
          </tr>
          <tr>
            <td>Total Pasivos</td>
            <td className="num">{formatCurrency(data.totalLiabilities)}</td>
          </tr>
          <tr>
            <td>Total Patrimonio</td>
            <td className="num">{formatCurrency(data.totalEquity)}</td>
          </tr>
        </tbody>
      </table>
    );
  }
  if (widgetKey === 'finance_summary') {
    return (
      <table className="data-table">
        <tbody>
          <tr>
            <td>Caja disponible</td>
            <td className="num">{formatCurrency(data.cashOnHand, data.baseCurrency)}</td>
          </tr>
          <tr>
            <td>Cuentas por cobrar vencidas</td>
            <td className="num">{formatCurrency(data.overdueReceivable, data.baseCurrency)}</td>
          </tr>
          <tr>
            <td>Cuentas por pagar próximas (8 semanas)</td>
            <td className="num">{formatCurrency(data.expectedNearTermOutflows, data.baseCurrency)}</td>
          </tr>
        </tbody>
      </table>
    );
  }
  if (widgetKey === 'liquidity_forecast') {
    return (
      <table className="data-table">
        <tbody>
          {data.weeks.slice(0, 4).map((week) => (
            <tr key={week.weekStart}>
              <td>{formatDate(new Date(week.weekStart))}</td>
              <td className="num">{formatCurrency(week.projectedBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (widgetKey === 'active_alerts') {
    return (
      <>
        <p className="text-hero" style={{ marginBottom: 12 }}>
          {data.count}
        </p>
        {data.alerts.length === 0 && <EmptyState icon="○" message="No hay alertas activas." />}
        {data.alerts.slice(0, 5).map((a) => (
          <p key={a.id} className="text-muted">
            {formatDate(new Date(a.createdAt))} — {a.message}
          </p>
        ))}
      </>
    );
  }
  return null;
}

export default function ExecutiveDashboardPage() {
  const [preferences, setPreferences] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [range] = useState({ from: defaultFrom, to: defaultTo, asOfDate: toIsoDate(new Date()) });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [preferencesData, dashboardData] = await Promise.all([
        executiveDashboardApi.getPreferences(),
        executiveDashboardApi.get(range),
      ]);
      setPreferences(preferencesData);
      setDashboard(dashboardData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el tablero ejecutivo.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleToggleVisible(pref) {
    try {
      await executiveDashboardApi.setPreference(pref.widgetKey, { isVisible: !pref.isVisible });
      await loadAll();
    } catch {
      // se refleja al recargar
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Widgets del tablero
            <HelpTooltip text="Elige qué tarjetas quieres ver en tu tablero ejecutivo. Cada quien puede personalizar su propia vista sin afectar la de los demás." />
          </h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Widget</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((pref) => (
                <tr key={pref.widgetKey}>
                  <td>{pref.label}</td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => handleToggleVisible(pref)}>
                      {pref.isVisible ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isLoading && !loadError && dashboard && dashboard.widgets.length === 0 && (
        <div className="panel">
          <EmptyState icon="▤" message="No tienes ningún widget visible. Muéstralo desde la lista de arriba." />
        </div>
      )}

      {!isLoading &&
        !loadError &&
        dashboard &&
        dashboard.widgets.map((widget) => (
          <div className="panel" key={widget.widgetKey}>
            <div className="panel-header">
              <h2>{widget.label}</h2>
            </div>
            <WidgetContent widgetKey={widget.widgetKey} data={widget.data} />
          </div>
        ))}
    </div>
  );
}
