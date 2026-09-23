import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { ADVANCED_ANALYTICS_TABS as TABS } from '../../config/moduleTabs';

export default function AdvancedAnalyticsLayout() {
  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Análisis Avanzados" tabs={TABS} />
      <div className="page-header">
        <h1>Análisis Avanzados</h1>
        <p className="page-subtitle">
          Los 16 tipos de análisis financiero de la empresa en un solo lugar: corrélos manualmente cuando quieras, o automatízalos para que se
          generen solos.
        </p>
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
