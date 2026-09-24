import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePinnedItems } from '../context/PinnedItemsContext';
import { accessLevelsApi } from '../api/access-levels';
import { panelPreferencesApi } from '../api/panel-preferences';
import {
  FINANCE_TABS,
  ACCOUNTING_TABS,
  TREASURY_TABS,
  AR_AP_TABS,
  SALES_TABS,
  INVENTORY_TABS,
  FISCAL_TABS,
  FPA_TABS,
  REPORTS_TABS,
  ADVANCED_ANALYTICS_TABS,
} from '../config/moduleTabs';
import QuickCreateFab from './QuickCreateFab';
import NotificationCenter from './NotificationCenter';
import GlobalProgressBar from './GlobalProgressBar';
import ContextualHelpButton from './ContextualHelpButton';
import CurrencySelector from '../core/ui/CurrencySelector';
import IncognitoToggle from '../core/ui/IncognitoToggle';
import Icon from '../core/ui/Icon';
import './AppLayout.css';

const SIDEBAR_PANEL_KEY = 'app-sidebar';

// Fase 9 (Centro Operativo): agrupación conceptual del menú lateral en
// las 6 áreas del prompt oficial — INICIO/OPERACIONES/FINANZAS/CONTROL/
// ANALÍTICA/CONFIGURACIÓN. Es puramente una etiqueta de sección sobre
// los MISMOS módulos/rutas que ya existían (ningún `to`, `subItems` ni
// permiso se tocó): "la implementación técnica puede conservar módulos
// internos, la experiencia del usuario no tiene que reflejar la
// arquitectura interna" (sección 15). Niveles de Acceso se agrega bajo
// CONFIGURACIÓN más abajo, condicionado a permisos, como ya hacía.
const NAV_AREAS = [
  {
    area: null, // Inicio no lleva encabezado de sección, es la puerta de entrada
    items: [{ to: '/', label: 'Panel principal', icon: '◆', end: true }],
  },
  {
    area: 'Operaciones',
    items: [
      { to: '/ventas', label: 'Ventas', icon: '⊹', subItems: SALES_TABS },
      { to: '/inventario', label: 'Inventario', icon: '⊞', subItems: INVENTORY_TABS },
    ],
  },
  {
    area: 'Finanzas',
    items: [
      { to: '/finanzas', label: 'Finanzas', icon: '◈', subItems: FINANCE_TABS },
      { to: '/contabilidad', label: 'Contabilidad', icon: '⊞', subItems: ACCOUNTING_TABS },
      { to: '/tesoreria', label: 'Tesorería', icon: '⊟', subItems: TREASURY_TABS },
      { to: '/cuentas', label: 'Cuentas por Cobrar y Pagar', icon: '⊠', subItems: AR_AP_TABS },
    ],
  },
  {
    area: 'Control',
    items: [{ to: '/fiscal', label: 'Fiscal', icon: '⊛', subItems: FISCAL_TABS }],
  },
  {
    area: 'Analítica',
    items: [
      { to: '/fpa', label: 'FP&A', icon: '⊡', subItems: FPA_TABS },
      { to: '/reportes', label: 'Reportes', icon: '▤', subItems: REPORTS_TABS },
      { to: '/metricas', label: 'Métricas del Negocio', icon: '◷' },
      { to: '/analisis-avanzados', label: 'Análisis Avanzados', icon: '✦', subItems: ADVANCED_ANALYTICS_TABS },
    ],
  },
];

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function AppLayout() {
  const { user, roleLabel, logout } = useAuth();
  const { items: pinnedItems, unpin } = usePinnedItems();
  const [hasAccessLevelsAccess, setHasAccessLevelsAccess] = useState(user?.role === 'ADMIN');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Menú colapsable a íconos (Feature M): reutiliza el mismo
  // core/panel-preferences que ya usan las tarjetas de resumen
  // ejecutivo — "contraído/expandido" es exactamente ese concepto,
  // aplicado acá al panel de navegación en vez de a un panel de datos.
  useEffect(() => {
    let isMounted = true;
    panelPreferencesApi
      .get(SIDEBAR_PANEL_KEY)
      .then((pref) => {
        if (isMounted) setIsCollapsed(pref.isCollapsed);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  function toggleCollapsed() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    panelPreferencesApi.set(SIDEBAR_PANEL_KEY, next).catch(() => {});
  }

  // Niveles de Acceso: visible siempre para el Administrador; para un
  // Contador solo si el Administrador le dio el permiso delegado
  // ACCESS_LEVELS — se consulta una vez al entrar, sin bloquear el
  // resto de la navegación mientras responde.
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      setHasAccessLevelsAccess(true);
      return;
    }
    if (user?.role !== 'ACCOUNTANT') {
      setHasAccessLevelsAccess(false);
      return;
    }
    let isMounted = true;
    accessLevelsApi
      .myPermissions()
      .then((result) => {
        if (isMounted) setHasAccessLevelsAccess(result.permissions.includes('ACCESS_LEVELS'));
      })
      .catch(() => {
        if (isMounted) setHasAccessLevelsAccess(false);
      });
    return () => {
      isMounted = false;
    };
  }, [user?.role]);

  const navAreas = hasAccessLevelsAccess
    ? [...NAV_AREAS, { area: 'Configuración', items: [{ to: '/niveles-de-acceso', label: 'Niveles de Acceso', icon: '⚿' }] }]
    : NAV_AREAS;

  return (
    <div className="app-shell">
      <GlobalProgressBar />
      <aside className={`app-sidebar${isCollapsed ? ' is-collapsed' : ''}`}>
        <div className="app-sidebar-brand">
          <span className="app-sidebar-mark">A</span>
          {!isCollapsed && <span className="app-sidebar-name">Alarfly</span>}
        </div>

        {pinnedItems.length > 0 && (
          <nav className="app-nav app-nav-pinned">
            {!isCollapsed && <p className="app-nav-section-title">Anclados</p>}
            {pinnedItems.map((item) => (
              <div key={item.id} className="app-nav-item-wrap app-nav-pinned-row">
                <NavLink
                  to={item.path}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={isCollapsed ? item.label : undefined}
                  className={({ isActive }) => `app-nav-link app-nav-pinned-link${isActive ? ' is-active' : ''}`}
                >
                  <span className="app-nav-icon" aria-hidden="true">
                    ◈
                  </span>
                  {!isCollapsed && <span className="app-nav-pinned-label">{item.label}</span>}
                </NavLink>
                {!isCollapsed && item.suggestUnpin && (
                  <span className="app-nav-pinned-suggest" title="No lo has visitado en un tiempo — considera desanclarlo">
                    ●
                  </span>
                )}
                {!isCollapsed && (
                  <button
                    type="button"
                    className="app-nav-pinned-unpin"
                    title="Desanclar"
                    onClick={(e) => {
                      e.preventDefault();
                      unpin(item.id);
                    }}
                  >
                    ×
                  </button>
                )}
                {isCollapsed && (
                  <div className="app-nav-flyout">
                    <p className="app-nav-flyout-title">{item.label}</p>
                    <button
                      type="button"
                      className="app-nav-flyout-unpin"
                      onClick={(e) => {
                        e.preventDefault();
                        unpin(item.id);
                      }}
                    >
                      Desanclar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </nav>
        )}

        <nav className="app-nav app-nav-main">
          {navAreas.map((group) => (
            <div key={group.area || 'inicio'} className="app-nav-area">
              {group.area && !isCollapsed && <p className="app-nav-section-title">{group.area}</p>}
              {group.items.map((item) => (
                <div key={item.to} className="app-nav-item-wrap">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={isCollapsed ? item.label : undefined}
                    className={({ isActive }) => `app-nav-link${isActive ? ' is-active' : ''}`}
                  >
                    <span className="app-nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    {!isCollapsed && item.label}
                  </NavLink>
                  {isCollapsed && (
                    <div className="app-nav-flyout">
                      <p className="app-nav-flyout-title">{item.label}</p>
                      {item.subItems && item.subItems.length > 0 && (
                        <div className="app-nav-flyout-links">
                          {item.subItems.map((sub) => (
                            <NavLink key={sub.to} to={sub.to} className="app-nav-flyout-link">
                              {sub.label}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <nav className="app-nav app-nav-logout-zone">
          <div className="app-nav-item-wrap">
            <button
              type="button"
              className="app-nav-link app-nav-logout"
              onClick={logout}
              title={isCollapsed ? 'Cerrar sesión' : undefined}
              aria-label={isCollapsed ? 'Cerrar sesión' : undefined}
            >
              <Icon name="logout" size={18} />
              {!isCollapsed && 'Cerrar sesión'}
            </button>
            {isCollapsed && (
              <div className="app-nav-flyout">
                <p className="app-nav-flyout-title">Cerrar sesión</p>
              </div>
            )}
          </div>
        </nav>

        <div className="app-sidebar-footer">
          {!isCollapsed && <p className="app-sidebar-hint">Alarfly · Plataforma financiera</p>}
          <button
            type="button"
            className="app-sidebar-collapse-toggle"
            onClick={toggleCollapsed}
            title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {isCollapsed ? '»' : '«'}
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div />
          <div className="app-topbar-user">
            <CurrencySelector />
            <IncognitoToggle />
            <NotificationCenter />
            <Link to="/mi-cuenta" className="app-topbar-user-info" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="app-topbar-user-name">{user?.name}</span>
              <span className="app-topbar-user-role">{roleLabel}</span>
            </Link>
            <Link to="/mi-cuenta" className="app-topbar-avatar" style={{ textDecoration: 'none' }} title="Mi Cuenta">
              {user ? initials(user.name) : ''}
            </Link>
            <button type="button" className="app-topbar-logout" onClick={logout}>
              <Icon name="logout" size={16} />
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <QuickCreateFab />
      <ContextualHelpButton />
    </div>
  );
}
