import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { FISCAL_TABS as TABS } from '../../config/moduleTabs';

export default function FiscalLayout() {
  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Fiscal" tabs={TABS} />
      <div className="page-header">
        <h1>Fiscal</h1>
        <p className="page-subtitle">Impuestos, retenciones, libros fiscales y documentos digitales.</p>
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
