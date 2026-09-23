import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { FPA_TABS as TABS } from '../../config/moduleTabs';

export default function FpaLayout() {
  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="FP&A" tabs={TABS} />
      <div className="page-header">
        <h1>FP&A</h1>
        <p className="page-subtitle">Dimensiones, presupuestos, desviaciones, simulador de escenarios y KPIs.</p>
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
