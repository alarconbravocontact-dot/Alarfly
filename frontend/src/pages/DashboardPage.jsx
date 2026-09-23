import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { accountingReportsApi } from '../api/accounting';
import { arInvoicesApi } from '../api/ar';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import ModuleCard from '../components/ModuleCard';
import IncomeExpenseChart from '../components/IncomeExpenseChart';
import SalesTrendChart from '../components/SalesTrendChart';
import JuntaWidget from '../components/JuntaWidget';
import SetupProgressBar from '../components/SetupProgressBar';
import GlossaryTerm from '../core/ui/GlossaryTerm';
import ConvertedAmount from '../core/ui/ConvertedAmount';
import CountUpNumber from '../core/ui/CountUpNumber';
import Amount from '../core/ui/Amount';
import { useIncognito } from '../context/IncognitoContext';
import { formatCurrency, formatDate, currentMonthRange, toIsoDate } from '../utils/format';
import './DashboardPage.css';

const { from, to } = currentMonthRange();

function lastMonths(count) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const year = now.getFullYear();
    const month = now.getMonth() - i;
    const monthFrom = new Date(Date.UTC(year, month, 1));
    const monthTo = new Date(Date.UTC(year, month + 1, 0));
    months.push({
      label: monthFrom.toLocaleDateString('es', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      from: toIsoDate(monthFrom),
      to: toIsoDate(monthTo),
    });
  }
  return months;
}

const MONTH_RANGES = lastMonths(6);

function monthLongLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function monthKeyRange(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { isIncognito } = useIncognito();
  const navigate = useNavigate();
  const [ebitda, setEbitda] = useState(null);
  const [burnRunway, setBurnRunway] = useState(null);
  const [cashPosition, setCashPosition] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [salesTrend, setSalesTrend] = useState(null);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [chartError, setChartError] = useState(false);
  const [isSalesTrendLoading, setIsSalesTrendLoading] = useState(true);
  const [salesTrendError, setSalesTrendError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      const [ebitdaResult, burnResult, cashResult] = await Promise.allSettled([
        api.get('/fpa/kpis/ebitda', { from, to }),
        api.get('/fpa/kpis/burn-rate-runway', { from, to }),
        api.get('/treasury/accounts/cash-position'),
      ]);

      if (!isMounted) return;

      setEbitda(ebitdaResult.status === 'fulfilled' ? ebitdaResult.value : null);
      setBurnRunway(burnResult.status === 'fulfilled' ? burnResult.value : null);
      setCashPosition(cashResult.status === 'fulfilled' ? cashResult.value : null);
      setErrors({
        ebitda: ebitdaResult.status === 'rejected',
        burnRunway: burnResult.status === 'rejected',
        cashPosition: cashResult.status === 'rejected',
      });
      setIsLoading(false);
    }

    async function loadChart() {
      const results = await Promise.allSettled(MONTH_RANGES.map((m) => accountingReportsApi.incomeStatement(m.from, m.to)));
      if (!isMounted) return;

      const anyFulfilled = results.some((r) => r.status === 'fulfilled');
      setChartData(
        MONTH_RANGES.map((m, i) => ({
          label: m.label,
          from: m.from,
          to: m.to,
          income: results[i].status === 'fulfilled' ? Number(results[i].value.totalIncome) : 0,
          expense: results[i].status === 'fulfilled' ? Number(results[i].value.totalExpense) : 0,
        }))
      );
      setChartError(!anyFulfilled);
      setIsChartLoading(false);
    }

    async function loadSalesTrend() {
      try {
        const trend = await arInvoicesApi.salesTrend(6);
        if (!isMounted) return;
        setSalesTrend(trend);
      } catch {
        if (!isMounted) return;
        setSalesTrendError(true);
      } finally {
        if (isMounted) setIsSalesTrendLoading(false);
      }
    }

    loadDashboard();
    loadChart();
    loadSalesTrend();
    return () => {
      isMounted = false;
    };
  }, []);

  const currency = cashPosition?.baseCurrency || 'USD';
  const isBurning = burnRunway && Number(burnRunway.monthlyBurnRate) > 0;

  function handleIncomeExpenseClick(type, point) {
    navigate('/reportes/transacciones', {
      state: {
        type,
        from: point.from,
        to: point.to,
        monthLabel: point.label,
      },
    });
  }

  function handleSalesPointClick(point) {
    const { from, to } = monthKeyRange(point.month);
    navigate('/cuentas/facturas-venta', {
      state: {
        drillDown: {
          from,
          to,
          monthLabel: monthLongLabel(point.month),
        },
      },
    });
  }

  return (
    <div className="dashboard">
      <SetupProgressBar />
      <div className="dashboard-header">
        <div>
          <h1>Hola, {user?.name?.split(' ')[0]}</h1>
          <p className="dashboard-subtitle">
            Resumen de {formatDate(new Date(`${from}T00:00:00`))} a {formatDate(new Date(`${to}T00:00:00`))}
          </p>
        </div>
      </div>

      <section className="dashboard-stats">
        <StatCard
          label={
            <>
              Posición de caja consolidada · <GlossaryTerm termKey="liquidity-cushion">Colchón de liquidez</GlossaryTerm>
            </>
          }
          value={cashPosition ? <ConvertedAmount amount={cashPosition.totalInBaseCurrency} /> : '—'}
          hint={
            cashPosition ? (
              <>Colchón de liquidez: {isIncognito ? '••••••' : formatCurrency(cashPosition.liquidityCushion, currency)}</>
            ) : null
          }
          isLoading={isLoading}
          error={errors.cashPosition}
        />
        <StatCard
          label={
            <>
              <GlossaryTerm termKey="ebitda">EBITDA</GlossaryTerm> del periodo
            </>
          }
          value={ebitda ? <ConvertedAmount amount={ebitda.ebitda} /> : '—'}
          hint={ebitda ? <>Utilidad neta: {isIncognito ? '••••••' : formatCurrency(ebitda.netIncome, currency)}</> : null}
          isLoading={isLoading}
          error={errors.ebitda}
        />
        <StatCard
          label={
            <>
              <GlossaryTerm termKey="burn-rate">Burn rate</GlossaryTerm> mensual
            </>
          }
          value={burnRunway ? <Amount value={burnRunway.monthlyBurnRate} currency={currency} /> : '—'}
          hint={isBurning ? 'La operación está consumiendo caja este periodo.' : 'La operación no está consumiendo caja.'}
          tone={isBurning ? 'negative' : 'positive'}
          isLoading={isLoading}
          error={errors.burnRunway}
        />
        <StatCard
          label={<GlossaryTerm termKey="runway">Runway</GlossaryTerm>}
          value={
            burnRunway?.runwayMonths ? (
              <CountUpNumber value={Number(burnRunway.runwayMonths)} format={(n) => `${Math.round(n)} meses`} />
            ) : (
              'No aplica'
            )
          }
          hint="Meses de caja disponibles al ritmo actual de consumo."
          tone={burnRunway?.runwayMonths ? 'warning' : 'positive'}
          isLoading={isLoading}
          error={errors.burnRunway}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Ingresos y egresos de los últimos 6 meses</h2>
        </div>
        {isChartLoading && <p className="text-muted">Cargando…</p>}
        {!isChartLoading && chartError && (
          <p className="alert-box alert-box-error">No se pudo cargar el gráfico de ingresos y egresos.</p>
        )}
        {!isChartLoading && !chartError && chartData && (
          <IncomeExpenseChart data={chartData} currency={currency} onSegmentClick={handleIncomeExpenseClick} />
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Comportamiento de ventas de los últimos 6 meses</h2>
        </div>
        {isSalesTrendLoading && <p className="text-muted">Cargando…</p>}
        {!isSalesTrendLoading && salesTrendError && (
          <p className="alert-box alert-box-error">No se pudo cargar el gráfico de comportamiento de ventas.</p>
        )}
        {!isSalesTrendLoading && !salesTrendError && salesTrend && (
          <SalesTrendChart data={salesTrend} currency={currency} onPointClick={handleSalesPointClick} />
        )}
      </section>

      <JuntaWidget />

      <section className="dashboard-modules">
        <h2 className="dashboard-section-title">Módulos</h2>
        <div className="dashboard-modules-grid">
          <ModuleCard
            to="/contabilidad"
            icon="⊞"
            title="Contabilidad"
            description="Plan de cuentas, asientos y estados financieros"
          />
          <ModuleCard
            to="/tesoreria"
            icon="⊟"
            title="Tesorería"
            description="Bancos, conciliación, pagos y deuda"
          />
          <ModuleCard
            to="/cuentas"
            icon="⊠"
            title="Cuentas por Cobrar y Pagar"
            description="Clientes, proveedores, facturas y cobros"
          />
          <ModuleCard
            to="/inventario"
            icon="⊞"
            title="Inventario"
            description="Productos, stock, movimientos y compras"
          />
          <ModuleCard
            to="/fiscal"
            icon="⊛"
            title="Fiscal"
            description="Impuestos, retenciones y facturación electrónica"
          />
          <ModuleCard
            to="/fpa"
            icon="⊡"
            title="FP&A"
            description="Presupuestos, desviaciones y simulaciones"
          />
          <ModuleCard
            to="/reportes"
            icon="▤"
            title="Reportes"
            description="Estados financieros, flujo de caja y rentabilidad"
          />
          <ModuleCard
            to="/metricas"
            icon="◷"
            title="Métricas del Negocio"
            description="Registra tus propios indicadores y ve su evolución"
          />
        </div>
      </section>
    </div>
  );
}
