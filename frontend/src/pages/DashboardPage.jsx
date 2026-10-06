import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { executiveDashboardApi } from '../api/reports';
import { accountingReportsApi } from '../api/accounting';
import { arInvoicesApi } from '../api/ar';
import { notificationsApi } from '../api/notifications';
import { alertLink } from '../config/alertLinks';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import StatCard from '../components/StatCard';
import IncomeExpenseChart from '../components/IncomeExpenseChart';
import SalesTrendChart from '../components/SalesTrendChart';
import JuntaWidget from '../components/JuntaWidget';
import SetupProgressBar from '../components/SetupProgressBar';
import GlossaryTerm from '../core/ui/GlossaryTerm';
import ConvertedAmount from '../core/ui/ConvertedAmount';
import Amount from '../core/ui/Amount';
import CountUpNumber from '../core/ui/CountUpNumber';
import Button from '../core/ui/Button';
import EmptyState from '../core/ui/EmptyState';
import { formatCurrency, formatDate, currentMonthRange, toIsoDate } from '../utils/format';
import './DashboardPage.css';

const { from, to } = currentMonthRange();

// Roles que ya tienen acceso real a esta información en su módulo de
// origen (mismo mapa que `core/rbac/module-access.js` del backend) —
// se usa acá SOLO como pista de presentación, para no mostrarle a un
// Colaborador un gráfico que de todas formas el servidor le va a negar
// (evita el estado de error confuso; el bloqueo real sigue siendo del
// servidor, no de esta lista).
const ACCOUNTING_ROLES = ['ADMIN', 'ACCOUNTANT', 'FINANCE'];
const SALES_ROLES = ['ADMIN', 'COLLABORATOR'];

// Acciones rápidas del Centro Operativo (sección 7 del prompt de
// Fase 9): cada una navega directo a la pantalla real donde ya se
// registra esa operación — nunca un circuito nuevo. Los roles listados
// son los mismos que ya exige cada pantalla de destino
// (`core/rbac/module-access.js`: sales/accounts-receivable/accounts-payable
// → ADMIN+COLLABORATOR; inventory → ADMIN+COLLABORATOR).
const QUICK_ACTIONS = [
  {
    key: 'new-sale',
    label: '+ Nueva Venta',
    roles: ['ADMIN', 'COLLABORATOR'],
    menu: [
      { label: 'Venta rápida', hint: 'Registrar en pocos pasos', path: '/ventas/rapida' },
      { label: 'Venta completa', hint: 'Factura con más detalle', path: '/cuentas/facturas-venta', state: { autoOpenCreate: true } },
    ],
  },
  { key: 'new-purchase', label: '+ Nueva Compra', roles: ['ADMIN', 'COLLABORATOR'], path: '/cuentas/facturas-compra', state: { autoOpenCreate: true } },
  { key: 'new-collection', label: '+ Nuevo Cobro', roles: ['ADMIN', 'COLLABORATOR'], path: '/cuentas/cobros' },
  { key: 'new-payment', label: '+ Nuevo Pago', roles: ['ADMIN', 'COLLABORATOR'], path: '/cuentas/pagos' },
  { key: 'new-product', label: '+ Nuevo Producto', roles: ['ADMIN', 'COLLABORATOR'], path: '/inventario/catalogo' },
  { key: 'new-customer', label: '+ Nuevo Cliente', roles: ['ADMIN', 'COLLABORATOR'], path: '/cuentas/clientes', state: { autoOpenCreate: true } },
  { key: 'new-vendor', label: '+ Nuevo Proveedor', roles: ['ADMIN', 'COLLABORATOR'], path: '/cuentas/proveedores' },
  // Integración de Personal (sección 7 del pedido): mismos 3 accesos
  // rápidos que ya tiene Personal > Resumen, ofrecidos también desde el
  // Inicio para quien empieza su día ahí — mismos roles que ya exige el
  // propio módulo (`core/rbac/module-access.js`: personal → ADMIN/FINANCE).
  { key: 'new-employee', label: '+ Nuevo Empleado', roles: ['ADMIN', 'FINANCE'], path: '/personal/empleados', state: { autoOpenCreate: true } },
  { key: 'new-payroll', label: '+ Nueva Nómina', roles: ['ADMIN', 'FINANCE'], path: '/personal/nomina', state: { autoOpenCreate: true } },
  { key: 'new-personnel-expense', label: '+ Registrar Gasto de Personal', roles: ['ADMIN', 'FINANCE'], path: '/personal/gastos', state: { autoOpenCreate: true } },
];

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

const SEVERITY_DOT = { CRITICAL: 'is-critical', WARNING: 'is-warning', INFO: 'is-info' };

// Renderiza el contenido de cada widget de "Estado de la empresa" — el
// propio backend (`dashboard.service.js`) ya decidió CUÁLES widgets le
// tocan a este usuario (RBAC) y con qué datos; acá solo se traduce
// cada `widgetKey` a una tarjeta. Un widget desconocido no rompe nada,
// simplemente no se dibuja.
function EstadoWidgets({ widgets, currency }) {
  const cards = [];

  const financeSummary = widgets.find((w) => w.widgetKey === 'finance_summary');
  if (financeSummary) {
    const d = financeSummary.data;
    cards.push(
      <StatCard
        key="cash"
        label="Caja disponible"
        value={<ConvertedAmount amount={d.cashOnHand} />}
        hint={`Liquidez disponible: ${formatCurrency(d.availableLiquidity, d.baseCurrency)}`}
      />,
      <StatCard
        key="ar-overdue"
        label="Cuentas por cobrar vencidas"
        value={<Amount value={d.overdueReceivable} currency={d.baseCurrency} />}
        tone={Number(d.overdueReceivable) > 0 ? 'warning' : 'positive'}
        hint={`Total por cobrar: ${formatCurrency(d.totalReceivable, d.baseCurrency)}`}
      />,
      <StatCard
        key="ap-near-term"
        label="Cuentas por pagar próximas"
        value={<Amount value={d.expectedNearTermOutflows} currency={d.baseCurrency} />}
        hint={`Próximas 8 semanas · Total por pagar: ${formatCurrency(d.totalPayable, d.baseCurrency)}`}
      />
    );
  }

  const ebitda = widgets.find((w) => w.widgetKey === 'ebitda');
  if (ebitda) {
    cards.push(
      <StatCard
        key="ebitda"
        label={
          <>
            <GlossaryTerm termKey="ebitda">EBITDA</GlossaryTerm> del periodo
          </>
        }
        value={<ConvertedAmount amount={ebitda.data.ebitda} />}
        hint={`Utilidad neta: ${formatCurrency(ebitda.data.netIncome, currency)}`}
      />
    );
  }

  const burnRunway = widgets.find((w) => w.widgetKey === 'burn_rate_runway');
  if (burnRunway) {
    const isBurning = Number(burnRunway.data.monthlyBurnRate) > 0;
    cards.push(
      <StatCard
        key="burn"
        label={
          <>
            <GlossaryTerm termKey="burn-rate">Burn rate</GlossaryTerm> mensual
          </>
        }
        value={<Amount value={burnRunway.data.monthlyBurnRate} currency={currency} />}
        tone={isBurning ? 'negative' : 'positive'}
        hint={isBurning ? 'La operación está consumiendo caja este periodo.' : 'La operación no está consumiendo caja.'}
      />,
      <StatCard
        key="runway"
        label={<GlossaryTerm termKey="runway">Runway</GlossaryTerm>}
        value={
          burnRunway.data.runwayMonths ? (
            <CountUpNumber value={Number(burnRunway.data.runwayMonths)} format={(n) => `${Math.round(n)} meses`} />
          ) : (
            'No aplica'
          )
        }
        tone={burnRunway.data.runwayMonths ? 'warning' : 'positive'}
        hint="Meses de caja disponibles al ritmo actual de consumo."
      />
    );
  }

  // Integración de Personal con el Inicio: el widget `personal_summary`
  // ya trae exactamente los mismos 6 números que Personal > Resumen
  // (nada se recalcula acá) — se muestran solo 2, los más accionables
  // (costo total y lo pendiente), cada uno con un enlace directo a la
  // pantalla real donde se resuelve, mismo criterio que "cada indicador
  // debe llevar a la pantalla correcta" del pedido de integración.
  const personalSummary = widgets.find((w) => w.widgetKey === 'personal_summary');
  if (personalSummary) {
    const d = personalSummary.data;
    const pendingTotal = Number(d.pendingPayroll) + Number(d.pendingExpenses);
    cards.push(
      <StatCard
        key="personal-cost"
        label="Costo de personal del período"
        value={<Amount value={d.totalPersonnelCost} currency={currency} />}
        hint={<Link to="/personal/resumen">Ver Personal →</Link>}
      />,
      <StatCard
        key="personal-pending"
        label="Nómina y gastos pendientes"
        value={<Amount value={pendingTotal} currency={currency} />}
        tone={pendingTotal > 0 ? 'warning' : 'positive'}
        hint={<Link to="/personal/nomina">Ver Nómina →</Link>}
      />
    );
  }

  if (cards.length === 0) return null;
  return <section className="dashboard-stats">{cards}</section>;
}

// "Requiere tu atención" (sección 6 del prompt): cada alerta ya trae su
// propio mensaje con contexto (severidad + descripción real, del mismo
// motor central de alertas — `core/alerts`, jamás uno nuevo) y navega
// directo a la pantalla donde se resuelve, con el mismo mapa que ya usa
// la campana de notificaciones.
// Fase 12 (Centro Operativo Inteligente, sección 8): una tarjeta de
// alerta simple solo dice "qué pasó" — un insight además dice "con qué
// datos" y "qué se recomienda", con evidencia concreta debajo del
// título (sección 19, "toda recomendación debe poder explicar"). No es
// un componente nuevo tipo "InsightCardPremium" (sección 43 lo prohíbe
// explícito) — es el mismo `Button`/mismo punto de severidad que ya
// usa una alerta normal, solo con más contenido adentro de la misma
// tarjeta `.dashboard-attention-card`.
function InsightCard({ insight }) {
  const navigate = useNavigate();
  return (
    <div className="dashboard-attention-card dashboard-insight-card">
      <span className={`dashboard-attention-dot ${SEVERITY_DOT[insight.severity] || 'is-info'}`} aria-hidden="true" />
      <div className="dashboard-insight-body">
        <span className="dashboard-attention-message">
          <strong>{insight.title}.</strong> {insight.description}
        </span>
        {insight.evidence.length > 0 && (
          <ul className="dashboard-insight-evidence">
            {insight.evidence.map((item, i) => (
              <li key={item.label || item.name || i}>
                {item.label || item.name}: {formatCurrency(item.value ?? item.balance, item.currency)}
                {item.daysOverdue != null ? ` · ${item.daysOverdue} día(s) vencida` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button size="sm" onClick={() => navigate(insight.action.to)}>
        {insight.action.label}
      </Button>
    </div>
  );
}

function AttentionSection({ alerts, insights, isLoading }) {
  const navigate = useNavigate();
  const visibleInsights = (insights || []).filter(Boolean);
  const isEmpty = alerts.length === 0 && visibleInsights.length === 0;

  return (
    <section className="panel">
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">Requiere tu atención</h2>
      </div>
      {isLoading && <p className="text-muted">Cargando…</p>}
      {!isLoading && isEmpty && <EmptyState icon="✓" message="No hay nada urgente que atender por ahora." />}
      {!isLoading && !isEmpty && (
        <div className="dashboard-attention-list">
          {visibleInsights.map((insight) => (
            <InsightCard key={insight.type} insight={insight} />
          ))}
          {alerts.map((alert) => (
            <div key={alert.id} className="dashboard-attention-card">
              <span className={`dashboard-attention-dot ${SEVERITY_DOT[alert.severity] || 'is-info'}`} aria-hidden="true" />
              <span className="dashboard-attention-message">{alert.message}</span>
              <Button size="sm" onClick={() => navigate(alertLink(alert.type))}>
                Ver
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// "Acciones rápidas" (sección 7): filtradas por rol antes de mostrarse
// (mismo criterio que ya usa QuickCreateFab) — un botón que el usuario
// no podría usar de todas formas ni siquiera aparece.
function QuickActionsSection({ role }) {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);
  const actions = QUICK_ACTIONS.filter((a) => a.roles.includes(role));

  if (actions.length === 0) return null;

  function go(action, item) {
    setOpenMenu(null);
    if (item) {
      navigate(item.path, item.state ? { state: item.state } : undefined);
    } else {
      navigate(action.path, action.state ? { state: action.state } : undefined);
    }
  }

  return (
    <section className="panel">
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">Acciones rápidas</h2>
      </div>
      <div className="dashboard-quick-actions">
        {actions.map((action) =>
          action.menu ? (
            <div className="dashboard-quick-action-group" key={action.key}>
              <Button variant="primary" onClick={() => setOpenMenu(openMenu === action.key ? null : action.key)}>
                {action.label}
              </Button>
              {openMenu === action.key && (
                <div className="dashboard-quick-action-menu" role="menu">
                  {action.menu.map((item) => (
                    <button key={item.label} type="button" onClick={() => go(action, item)}>
                      <strong>{item.label}</strong>
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        {item.hint}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Button key={action.key} onClick={() => go(action)}>
              {action.label}
            </Button>
          )
        )}
      </div>
    </section>
  );
}

// Previsión de Liquidez (Visión del negocio): reutiliza tal cual el
// widget `liquidity_forecast`, que a su vez reutiliza
// `treasury/liquidity-forecast.service` — nunca un segundo forecast.
function LiquidityForecastWidget({ widget }) {
  if (!widget) return null;
  const weeks = widget.data.weeks || [];
  return (
    <section className="panel">
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">Previsión de liquidez (8 semanas)</h2>
      </div>
      {widget.data.note && <p className="dashboard-section-caption">{widget.data.note}</p>}
      <div className="dashboard-liquidity-weeks">
        {weeks.map((week) => (
          <div key={week.weekStart} className={`dashboard-liquidity-week${Number(week.projectedBalance) < 0 ? ' is-negative' : ''}`}>
            <div className="dashboard-liquidity-week-label">{formatDate(new Date(week.weekStart))}</div>
            <div className="dashboard-liquidity-week-balance">{formatCurrency(week.projectedBalance)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Modo edición del Inicio (sección 10-11 del prompt): mostrar/ocultar +
// reordenar (mover arriba/abajo, sin necesitar arrastrar-y-soltar,
// explícitamente permitido) + restaurar configuración predeterminada.
function EditPanel({ preferences, onToggle, onMove, onReset, onClose }) {
  return (
    <div className="dashboard-edit-panel">
      <p className="dashboard-section-caption">Elige qué widgets ver en tu Inicio y en qué orden.</p>
      {preferences.map((pref, index) => (
        <div className="dashboard-edit-row" key={pref.widgetKey}>
          <label className="dashboard-edit-row-label">
            <input type="checkbox" checked={pref.isVisible} onChange={() => onToggle(pref.widgetKey, !pref.isVisible)} /> {pref.label}
          </label>
          <div className="dashboard-edit-row-order">
            <Button size="sm" disabled={index === 0} onClick={() => onMove(pref.widgetKey, -1)} aria-label="Mover arriba">
              ▲
            </Button>
            <Button size="sm" disabled={index === preferences.length - 1} onClick={() => onMove(pref.widgetKey, 1)} aria-label="Mover abajo">
              ▼
            </Button>
          </div>
        </div>
      ))}
      <div className="dashboard-edit-actions">
        <Button size="sm" onClick={onReset}>
          Restaurar configuración predeterminada
        </Button>
        <Button size="sm" variant="primary" onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);

  const [alerts, setAlerts] = useState([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(true);

  const [chartData, setChartData] = useState(null);
  const [salesTrend, setSalesTrend] = useState(null);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [chartError, setChartError] = useState(false);
  const [isSalesTrendLoading, setIsSalesTrendLoading] = useState(true);
  const [salesTrendError, setSalesTrendError] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editPreferences, setEditPreferences] = useState([]);

  const canSeeFinancials = ACCOUNTING_ROLES.includes(user?.role);
  const canSeeSales = SALES_ROLES.includes(user?.role);

  function loadDashboard() {
    setIsDashboardLoading(true);
    executiveDashboardApi
      .get({ from, to })
      .then((data) => {
        setDashboard(data);
        setDashboardError(false);
      })
      .catch(() => setDashboardError(true))
      .finally(() => setIsDashboardLoading(false));
  }

  function loadAlerts() {
    setIsAlertsLoading(true);
    notificationsApi
      .list({ status: 'ACTIVE' })
      .then((data) => setAlerts(data.slice(0, 8)))
      .catch(() => setAlerts([]))
      .finally(() => setIsAlertsLoading(false));
  }

  useEffect(() => {
    let isMounted = true;

    loadDashboard();
    loadAlerts();

    async function loadChart() {
      if (!canSeeFinancials) {
        setIsChartLoading(false);
        return;
      }
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
      if (!canSeeSales) {
        setIsSalesTrendLoading(false);
        return;
      }
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

    loadChart();
    loadSalesTrend();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const widgets = dashboard?.widgets || [];
  // Un rol sin ningún widget de "Estado general" visible (ej.
  // Colaborador, que no ve finanzas) no debe mostrar el encabezado de
  // la sección igual — quedaría flotando sin nada debajo. Mismos
  // widgetKeys que ya lee `EstadoWidgets` más abajo.
  const hasEstadoWidgets = widgets.some((w) => ['finance_summary', 'ebitda', 'burn_rate_runway', 'personal_summary'].includes(w.widgetKey));
  const showEstadoSection = isDashboardLoading || dashboardError || hasEstadoWidgets;
  const activeAlertsWidget = widgets.find((w) => w.widgetKey === 'active_alerts');
  const liquidityWidget = widgets.find((w) => w.widgetKey === 'liquidity_forecast');
  const liquidityInsightWidget = widgets.find((w) => w.widgetKey === 'liquidity_insight');
  const collectionsInsightWidget = widgets.find((w) => w.widgetKey === 'collections_insight');
  const insights = [liquidityInsightWidget?.data, collectionsInsightWidget?.data];
  const currency = widgets.find((w) => w.widgetKey === 'finance_summary')?.data.baseCurrency || 'USD';

  function openEditPanel() {
    executiveDashboardApi.getPreferences().then((prefs) => {
      setEditPreferences(prefs);
      setIsEditing(true);
    });
  }

  function toggleWidget(widgetKey, isVisible) {
    setEditPreferences((prev) => prev.map((p) => (p.widgetKey === widgetKey ? { ...p, isVisible } : p)));
    executiveDashboardApi.setPreference(widgetKey, { isVisible }).then(loadDashboard);
  }

  function moveWidget(widgetKey, direction) {
    setEditPreferences((prev) => {
      const index = prev.findIndex((p) => p.widgetKey === widgetKey);
      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      next.forEach((p, i) => {
        p.order = i;
        executiveDashboardApi.setPreference(p.widgetKey, { order: i });
      });
      return next;
    });
    loadDashboard();
  }

  async function resetWidgets() {
    const ok = await confirm({
      title: 'Restaurar configuración predeterminada',
      message: 'Tu Inicio volverá al orden y la visibilidad original de los widgets. No se borra ningún dato de la empresa.',
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;
    await executiveDashboardApi.resetPreferences();
    const prefs = await executiveDashboardApi.getPreferences();
    setEditPreferences(prefs);
    loadDashboard();
  }

  return (
    <div className="dashboard">
      <SetupProgressBar />
      <div className="dashboard-header">
        <div>
          <h1>Hola, {user?.name?.split(' ')[0]}</h1>
          <p className="dashboard-subtitle">
            Resumen de {formatDate(new Date(`${from}T00:00:00`))} a {formatDate(new Date(`${to}T00:00:00`))} · {currency}
          </p>
        </div>
        <Button size="sm" onClick={() => (isEditing ? setIsEditing(false) : openEditPanel())}>
          {isEditing ? 'Cerrar personalización' : 'Personalizar Inicio'}
        </Button>
      </div>

      {isEditing && (
        <EditPanel
          preferences={editPreferences}
          onToggle={toggleWidget}
          onMove={moveWidget}
          onReset={resetWidgets}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* Capa 1: Estado de la empresa — mismo encabezado uppercase/muted
          que ya usan Atención/Acciones/Evolución, para que la jerarquía
          ESTADO→ATENCIÓN→ACCIÓN→EVOLUCIÓN del rediseño maestro sea
          visualmente explícita, no solo un orden implícito. Un rol sin
          ningún widget de Estado visible (ej. Colaborador) no muestra
          el encabezado — evita una sección con título y nada debajo. */}
      {showEstadoSection && <h2 className="dashboard-section-title">Estado general</h2>}
      {!isDashboardLoading && dashboardError && (
        <p className="alert-box alert-box-error">No se pudo cargar el estado de la empresa.</p>
      )}
      {isDashboardLoading && (
        <section className="dashboard-stats">
          <StatCard label="Cargando…" value="—" isLoading />
          <StatCard label="Cargando…" value="—" isLoading />
        </section>
      )}
      {!isDashboardLoading && !dashboardError && <EstadoWidgets widgets={widgets} currency={currency} />}

      {/* Capa 2: Requiere tu atención */}
      <AttentionSection
        alerts={activeAlertsWidget ? activeAlertsWidget.data.alerts : alerts}
        insights={insights}
        isLoading={isAlertsLoading && isDashboardLoading}
      />

      {/* Capa 3: Acciones rápidas */}
      <QuickActionsSection role={user?.role} />

      {/* Capa 4: Evolución del negocio — agrupa los 3 widgets existentes
          (ingresos/egresos, ventas, previsión de liquidez) bajo un
          mismo encabezado y, en pantallas anchas, los 2 gráficos de
          tendencia van lado a lado en vez de apilados uno debajo del
          otro — para que se sientan una sola sección con varias
          vistas, no 3 paneles inconexos (documento maestro, Etapa 2:
          "no conviertas cada gráfico en una tarjeta aislada"). Ningún
          dato ni fuente cambia: sigue siendo exactamente
          IncomeExpenseChart/SalesTrendChart/LiquidityForecastWidget
          con las mismas props. */}
      {(canSeeFinancials || canSeeSales) && (
        <section>
          <h2 className="dashboard-section-title">Evolución del negocio</h2>
          <div className="dashboard-evolution-grid">
            {canSeeFinancials && (
              <div className="panel">
                <div className="panel-header">
                  <h2>Ingresos y egresos de los últimos 6 meses</h2>
                </div>
                {isChartLoading && <p className="text-muted">Cargando…</p>}
                {!isChartLoading && chartError && (
                  <p className="alert-box alert-box-error">No se pudo cargar el gráfico de ingresos y egresos.</p>
                )}
                {!isChartLoading && !chartError && chartData && (
                  <IncomeExpenseChart
                    data={chartData}
                    currency={currency}
                    onSegmentClick={(type, point) => navigate('/reportes/transacciones', { state: { type, from: point.from, to: point.to, monthLabel: point.label } })}
                  />
                )}
              </div>
            )}

            {canSeeSales && (
              <div className="panel">
                <div className="panel-header">
                  <h2>
                    Comportamiento de <GlossaryTerm termKey="sales-this-month">ventas</GlossaryTerm> de los últimos 6 meses
                  </h2>
                </div>
                {isSalesTrendLoading && <p className="text-muted">Cargando…</p>}
                {!isSalesTrendLoading && salesTrendError && (
                  <p className="alert-box alert-box-error">No se pudo cargar el gráfico de comportamiento de ventas.</p>
                )}
                {!isSalesTrendLoading && !salesTrendError && salesTrend && (
                  <SalesTrendChart
                    data={salesTrend}
                    currency={currency}
                    onPointClick={(point) => {
                      const { from, to } = monthKeyRange(point.month);
                      navigate('/cuentas/facturas-venta', { state: { drillDown: { from, to, monthLabel: monthLongLabel(point.month) } } });
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {canSeeFinancials && <LiquidityForecastWidget widget={liquidityWidget} />}
        </section>
      )}

      <JuntaWidget />
    </div>
  );
}
