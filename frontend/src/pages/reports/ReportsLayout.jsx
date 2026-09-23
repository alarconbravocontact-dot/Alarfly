import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import PinButton from '../../core/ui/PinButton';
import { REPORTS_TABS as TABS } from '../../config/moduleTabs';

export default function ReportsLayout() {
  const location = useLocation();
  const activeTab = TABS.find((tab) => location.pathname.startsWith(tab.to));

  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Reportes" tabs={TABS} />
      <div className="page-header">
        <h1>Reportes</h1>
        <p className="page-subtitle">Estados financieros, flujo de caja, rentabilidad y reportes ejecutivos.</p>
        {activeTab && <PinButton path={activeTab.to} label={`Reportes · ${activeTab.label}`} />}
      </div>

      <nav className="module-tabs" style={{ flexWrap: 'wrap' }}>
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
