import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { INVENTORY_TABS as TABS } from '../../config/moduleTabs';

export default function InventoryLayout() {
  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Inventario" tabs={TABS} />
      <div className="page-header">
        <h1>Inventario</h1>
        <p className="page-subtitle">Catálogo, almacenes, stock, movimientos y trazabilidad.</p>
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
