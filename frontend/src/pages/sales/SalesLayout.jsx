import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { SALES_TABS as TABS } from '../../config/moduleTabs';

export default function SalesLayout() {
  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Ventas" tabs={TABS} />
      <div className="page-header">
        <h1>Ventas</h1>
        <p className="page-subtitle">Venta Rápida, Pedidos y Entregas — todo conectado con inventario, facturación y cobros.</p>
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
