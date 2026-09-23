import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { FINANCE_TABS as TABS } from '../../config/moduleTabs';

// Fase 5: la puerta consolidada de Finanzas — Tesorería y Contabilidad
// dejan de sentirse como dos mundos aparte para quien solo quiere saber
// "cuánto tengo/me deben/debo". Cada pestaña de acá reutiliza, en su
// mayoría, la MISMA pantalla que ya existía en Tesorería/AR/AP/
// Contabilidad (mismo componente, otra ruta) — no se reconstruyó nada,
// ver App.jsx para confirmar qué se reutiliza tal cual.
export default function FinanzasLayout() {
  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Finanzas" tabs={TABS} />
      <div className="page-header">
        <h1>Finanzas</h1>
        <p className="page-subtitle">Dinero, cobros, pagos, cuentas por cobrar y pagar, financiamiento y liquidez — en un solo lugar.</p>
      </div>

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
