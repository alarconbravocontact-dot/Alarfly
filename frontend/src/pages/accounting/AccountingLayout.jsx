import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { ACCOUNTING_TABS as TABS } from '../../config/moduleTabs';

export default function AccountingLayout() {
  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Contabilidad" tabs={TABS} />
      <div className="page-header">
        <h1>Contabilidad</h1>
        <p className="page-subtitle">Plan de cuentas, asientos, estados financieros y cierre de periodos.</p>
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
