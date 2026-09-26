import { useCallback, useEffect, useState } from 'react';
import { executiveDashboardApi } from '../../api/reports';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate, currentMonthRange } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatCard from '../../components/StatCard';
import EmptyState from '../../core/ui/EmptyState';
import DateRangeSelector from '../../core/ui/DateRangeSelector';

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
  if (widgetKey === 'liquidity_insight' || widgetKey === 'collections_insight') {
    if (!data) return <EmptyState icon="✓" message="Nada que reportar por ahora." />;
    return (
      <>
        <p className="text-muted" style={{ marginBottom: 8 }}>
          {data.description}
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
          {data.evidence.map((item, i) => (
            <li key={item.label || item.name || i}>
              {item.label || item.name}: {formatCurrency(item.value ?? item.balance, item.currency)}
            </li>
          ))}
        </ul>
      </>
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
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);
  const [prefsError, setPrefsError] = useState('');

  const [dashboard, setDashboard] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  // Rediseño UX/UI (Etapa 6) — bug real corregido: este período era
  // fijo (mes actual) y nunca se podía cambiar — con el mismo catálogo
  // de widgets y las mismas preferencias que ya usa Inicio (comparten
  // `executiveDashboardApi`, un solo `DashboardWidgetPreference` por
  // usuario), este Tablero Ejecutivo era un clon exacto de Inicio sin
  // ninguna capacidad propia. Un reporte, a diferencia del Centro
  // Operativo de Inicio (siempre "ahora"), debe poder consultarse para
  // cualquier período — es la única diferencia real que justifica que
  // esta pantalla exista aparte, así que se le agregó el mismo
  // `DateRangeSelector` que ya usa el resto de Reportes/Auditoría, sin
  // tocar el catálogo de widgets ni las preferencias (siguen siendo la
  // misma fuente de verdad que Inicio, a propósito — nunca un segundo
  // Read Layer).
  const [range, setRange] = useState({ from: defaultFrom, to: defaultTo });

  const loadPreferences = useCallback(async () => {
    setIsPrefsLoading(true);
    setPrefsError('');
    try {
      setPreferences(await executiveDashboardApi.getPreferences());
    } catch (err) {
      setPrefsError(err instanceof ApiError ? err.message : 'No se pudieron cargar los widgets disponibles.');
    } finally {
      setIsPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const loadDashboard = useCallback(async () => {
    setIsDashboardLoading(true);
    setDashboardError('');
    try {
      setDashboard(await executiveDashboardApi.get({ ...range, asOfDate: range.to }));
    } catch (err) {
      setDashboardError(err instanceof ApiError ? err.message : 'No se pudo cargar el tablero ejecutivo.');
    } finally {
      setIsDashboardLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleToggleVisible(pref) {
    try {
      await executiveDashboardApi.setPreference(pref.widgetKey, { isVisible: !pref.isVisible });
      await Promise.all([loadPreferences(), loadDashboard()]);
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
            <HelpTooltip text="Elige qué tarjetas quieres ver en tu tablero ejecutivo. Cada quien puede personalizar su propia vista sin afectar la de los demás — incluido Inicio, que usa la misma lista de widgets." />
          </h2>
        </div>
        {isPrefsLoading && <p className="text-muted">Cargando…</p>}
        {!isPrefsLoading && prefsError && <p className="alert-box alert-box-error">{prefsError}</p>}
        {!isPrefsLoading && !prefsError && (
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

      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Período
            <HelpTooltip text="A diferencia de Inicio (que siempre muestra el mes actual), acá puedes consultar estos mismos widgets para cualquier período — útil para armar un reporte de un mes o trimestre ya cerrado." />
          </h2>
        </div>
        <DateRangeSelector value={range} onChange={setRange} initialKey="this-month" />
      </div>

      {isDashboardLoading && <p className="text-muted">Cargando…</p>}
      {!isDashboardLoading && dashboardError && <p className="alert-box alert-box-error">{dashboardError}</p>}

      {!isDashboardLoading && !dashboardError && dashboard && dashboard.widgets.length === 0 && (
        <div className="panel">
          <EmptyState icon="▤" message="No tienes ningún widget visible. Muéstralo desde la lista de arriba." />
        </div>
      )}

      {!isDashboardLoading &&
        !dashboardError &&
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
