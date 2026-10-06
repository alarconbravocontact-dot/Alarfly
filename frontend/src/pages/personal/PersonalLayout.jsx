import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { PERSONAL_TABS as TABS } from '../../config/moduleTabs';

export default function PersonalLayout() {
  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Personal" tabs={TABS} />
      <div className="page-header">
        <h1>Personal</h1>
        <p className="page-subtitle">Quién trabaja aquí, cuánto cuesta, cuánto se le debe y qué gastos tiene.</p>
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
