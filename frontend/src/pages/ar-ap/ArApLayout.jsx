import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { arExecutiveSummaryApi } from '../../api/ar';
import { formatCurrency } from '../../utils/format';
import ExecutiveSummaryCards from '../../core/ui/ExecutiveSummaryCards';
import GlossaryTerm from '../../core/ui/GlossaryTerm';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { AR_AP_TABS as TABS } from '../../config/moduleTabs';

export default function ArApLayout() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    arExecutiveSummaryApi
      .get()
      .then((data) => {
        if (isMounted) setSummary(data);
      })
      .catch(() => {
        if (isMounted) setError('No se pudo cargar el resumen ejecutivo.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const cards = summary
    ? [
        {
          key: 'totalReceivable',
          label: <GlossaryTerm termKey="accounts-receivable">{summary.totalReceivable.label}</GlossaryTerm>,
          numericValue: Number(summary.totalReceivable.value),
          format: (n) => formatCurrency(n),
          sparklineValues: summary.totalReceivable.sparkline.map((p) => Number(p.value)),
        },
        {
          key: 'overdue',
          label: summary.overdue.label,
          numericValue: Number(summary.overdue.value),
          format: (n) => formatCurrency(n),
          tone: Number(summary.overdue.value) > 0 ? 'negative' : 'positive',
          sparklineValues: summary.overdue.sparkline.map((p) => Number(p.value)),
        },
        {
          key: 'invoicedThisMonth',
          label: summary.invoicedThisMonth.label,
          numericValue: Number(summary.invoicedThisMonth.value),
          format: (n) => formatCurrency(n),
          sparklineValues: summary.invoicedThisMonth.sparkline.map((p) => Number(p.value)),
        },
        {
          key: 'collectedThisMonth',
          label: summary.collectedThisMonth.label,
          numericValue: Number(summary.collectedThisMonth.value),
          format: (n) => formatCurrency(n),
          tone: 'positive',
          sparklineValues: summary.collectedThisMonth.sparkline.map((p) => Number(p.value)),
        },
      ]
    : [];

  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Cuentas por Cobrar y por Pagar" tabs={TABS} />
      <div className="page-header">
        <h1>Cuentas por Cobrar y por Pagar</h1>
        <p className="page-subtitle">Clientes, proveedores, facturación, cobros y pagos.</p>
      </div>

      <ExecutiveSummaryCards panelKey="ar-ap-summary" title="Resumen del mes" cards={cards} isLoading={isLoading} error={error} />

      <nav className="module-tabs">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `module-tab${isActive ? ' is-active' : ''}`}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
