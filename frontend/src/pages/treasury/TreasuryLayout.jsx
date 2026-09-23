import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../../core/ui/ModuleBreadcrumb';
import { TREASURY_TABS as TABS } from '../../config/moduleTabs';

export default function TreasuryLayout() {
  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Tesorería" tabs={TABS} />
      <div className="page-header">
        <h1>Tesorería</h1>
        <p className="page-subtitle">
          Bancos y tarjetas, conciliación, pagos, deuda, caja chica, alertas y previsión de liquidez.
        </p>
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
