import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { financeApi } from '../../api/finance';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import StatCard from '../../components/StatCard';
import HelpTooltip from '../../components/HelpTooltip';
import './ResumenPage.css';

// Fase 5 (Finanzas), sección 7: responde de un vistazo las preguntas
// que antes exigían visitar Tesorería + Reportes + Deuda por separado.
// Cada número viene de /finance/summary (modules/finance), que a su vez
// reutiliza los servicios de siempre — esta pantalla no calcula nada,
// solo muestra.
export default function ResumenPage() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    financeApi
      .getSummary()
      .then((data) => {
        if (isMounted) setSummary(data);
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen financiero.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const currency = summary?.baseCurrency || 'USD';

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Resumen financiero
            <HelpTooltip text="Los mismos números de siempre (Tesorería, Cuentas por Cobrar y Pagar, Deuda), juntos en un solo lugar — nada nuevo se calcula acá." />
          </h2>
        </div>

        {error && <p className="alert-box alert-box-error">{error}</p>}

        {/* Rediseño UX/UI (Etapa 4): separadas en 2 grupos — posición
            actual (saldos de hoy) y previsión de las próximas 8
            semanas (un cálculo distinto, sobre vencimientos reales,
            nunca una simulación) — para no mezclar REAL con FORECAST
            bajo el mismo peso visual. Mismos 8 números de siempre, sin
            ningún cálculo nuevo. */}
        <div className="finance-summary-group">
          <p className="finance-summary-group-title">Posición actual</p>
          <section className="dashboard-stats">
            <StatCard
              label="¿Cuánto dinero tengo?"
              value={summary ? formatCurrency(summary.cashOnHand, currency) : '—'}
              hint="Posición de caja consolidada, todas las cuentas de Tesorería."
              isLoading={isLoading}
              error={error}
            />
            <StatCard
              label="¿Cuánto tengo disponible?"
              value={summary ? formatCurrency(summary.availableLiquidity, currency) : '—'}
              hint="Caja + líneas de crédito sin usar."
              isLoading={isLoading}
              error={error}
            />
            <StatCard
              label="¿Cuánto me deben?"
              value={summary ? formatCurrency(summary.totalReceivable, currency) : '—'}
              hint={<Link to="/finanzas/cxc">Ver Cuentas por Cobrar →</Link>}
              isLoading={isLoading}
              error={error}
            />
            <StatCard
              label="¿Cuánto debo?"
              value={summary ? formatCurrency(summary.totalPayable, currency) : '—'}
              tone={summary && Number(summary.totalPayable) > Number(summary.cashOnHand) ? 'negative' : 'neutral'}
              hint={<Link to="/finanzas/cxp">Ver Cuentas por Pagar →</Link>}
              isLoading={isLoading}
              error={error}
            />
            <StatCard
              label="¿Cuánto debo de financiamiento?"
              value={summary ? formatCurrency(summary.totalDebt, currency) : '—'}
              hint={<Link to="/finanzas/financiamiento">Ver Financiamiento →</Link>}
              isLoading={isLoading}
              error={error}
            />
            <StatCard
              label="¿Cuánto tengo comprometido?"
              value={summary ? formatCurrency(summary.committedPayments, currency) : '—'}
              hint="Órdenes de pago ya creadas, todavía sin aprobar ni ejecutar."
              isLoading={isLoading}
              error={error}
            />
          </section>
        </div>

        <div className="finance-summary-group">
          <p className="finance-summary-group-title">
            Previsión — próximas 8 semanas <HelpTooltip text="Calculado sobre facturas y cuotas con fecha de vencimiento real, nunca una simulación." />
          </p>
          <section className="dashboard-stats">
            <StatCard
              label="¿Cuánto espero cobrar pronto?"
              value={summary ? formatCurrency(summary.expectedNearTermInflows, currency) : '—'}
              hint="Próximas 8 semanas, según vencimientos reales."
              tone="positive"
              isLoading={isLoading}
              error={error}
            />
            <StatCard
              label="¿Cuánto espero pagar pronto?"
              value={summary ? formatCurrency(summary.expectedNearTermOutflows, currency) : '—'}
              hint={<Link to="/finanzas/liquidez">Ver Previsión de Liquidez →</Link>}
              tone="negative"
              isLoading={isLoading}
              error={error}
            />
          </section>
        </div>

        {/* Integración de Personal (sección 3 del pedido de integración
            transversal): visible solo si el backend la incluyó, que
            solo pasa si el rol de quien pregunta ya tiene acceso real a
            Personal (ADMIN/FINANCE) — para Colaborador/Contador,
            `summary.personnelObligations` llega `null` y esta sección
            no se muestra, sin relajar el permiso real de Personal. */}
        {summary?.personnelObligations && (
          <div className="finance-summary-group">
            <p className="finance-summary-group-title">Obligaciones de personal</p>
            <section className="dashboard-stats">
              <StatCard
                label="Nómina aprobada, pendiente de pago"
                value={formatCurrency(summary.personnelObligations.payrollPendingPayment, currency)}
                tone={Number(summary.personnelObligations.payrollPendingPayment) > 0 ? 'warning' : 'positive'}
                hint={<Link to="/personal/nomina">Ver Nómina →</Link>}
              />
              <StatCard
                label="Gastos aprobados, pendientes de reembolso"
                value={formatCurrency(summary.personnelObligations.expensesPendingReimbursement, currency)}
                tone={Number(summary.personnelObligations.expensesPendingReimbursement) > 0 ? 'warning' : 'positive'}
                hint={<Link to="/personal/gastos">Ver Gastos →</Link>}
              />
            </section>
          </div>
        )}

        {summary?.firstNegativeWeek && (
          <p className="alert-box alert-box-error" style={{ marginTop: 16 }}>
            El saldo proyectado se vuelve negativo la semana del{' '}
            {formatDate(new Date(summary.firstNegativeWeek.weekStart))} —{' '}
            <Link to="/finanzas/liquidez">revisa la Previsión de Liquidez</Link>.
          </p>
        )}

        {summary?.missingExchangeRates?.length > 0 && (
          <p className="alert-box alert-box-warning" style={{ marginTop: 12 }}>
            {summary.missingExchangeRates.length} cuenta(s)/deuda(s) en otra moneda no se pudieron convertir a{' '}
            {currency} por falta de una tasa de cambio registrada — no están incluidas en estos totales.
          </p>
        )}
      </div>
    </div>
  );
}
