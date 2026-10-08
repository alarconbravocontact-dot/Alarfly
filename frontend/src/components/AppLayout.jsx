import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { usePinnedItems } from '../context/PinnedItemsContext';
import { accessLevelsApi } from '../api/access-levels';
import { affiliateAdminApi } from '../api/affiliate-admin';
import { membershipAdminApi } from '../api/membership-admin';
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
  PERSONAL_TABS,
  moduleKeyForPath,
} from '../config/moduleTabs';
import { canAccessModule } from '../config/moduleAccess';
import QuickCreateFab from './QuickCreateFab';
import NotificationCenter from './NotificationCenter';
import TrialBanner from './TrialBanner';
import GlobalProgressBar from './GlobalProgressBar';
import ContextualHelpButton from './ContextualHelpButton';
import NavSearch from './NavSearch';
import CurrencySelector from '../core/ui/CurrencySelector';
import IncognitoToggle from '../core/ui/IncognitoToggle';
import Icon from '../core/ui/Icon';
import './AppLayout.css';

const SIDEBAR_PANEL_KEY = 'app-sidebar';

// Rediseño UX/UI (Etapa 1 — Shell global, sobre la arquitectura de
// navegación del documento maestro, sección 4): las mismas 6 áreas
// conceptuales de Fase 9 (INICIO/OPERACIONES/FINANZAS/CONTROL/
// ANALÍTICA/CONFIGURACIÓN), con dos correcciones reales sobre esa
// agrupación y ningún cambio de ruta/permiso/lógica:
//
// 1. "Auditoría" se mueve de CONFIGURACIÓN a CONTROL — el documento
//    maestro la pide ahí (junto a Alertas/Aprobaciones/Conciliaciones),
//    no junto a la gestión de usuarios.
// 2. "Finanzas" (Fase 5) ya ES la capa unificada que pide la sección 9
//    del documento maestro — sus 9 pestañas (ver moduleTabs.js) casi
//    calzan 1 a 1 con la lista pedida (Resumen/Dinero/Cobros/Pagos/
//    CxC/CxP/Financiamiento/Liquidez/Rentabilidad/Contabilidad
//    avanzada). Lo que el documento maestro pide (sección 21: "el
//    rediseño representa el negocio, no el código") es que Contabilidad/
//    Tesorería/Cuentas por Cobrar y Pagar dejen de sentirse como 3
//    módulos de negocio aparte. **No se ocultaron todavía** de esta
//    lista: Tesorería tiene 3 pestañas (Tarjetas, Caja Chica,
//    Conciliación) y Cuentas por Cobrar y Pagar tiene 2 (Notas de
//    Crédito/a Proveedores) que HOY no están cubiertas por ningún tab
//    de Finanzas — ocultarlas ahora las dejaría inalcanzables desde el
//    menú (regresión real, prohibida por la sección 18 del prompt
//    oficial de F13). Auditado y documentado como pendiente explícito
//    de la Etapa 4 (Finanzas) y Etapa 5 (Control, donde Conciliación
//    debe terminar viviendo per sección 9/10 del documento maestro) —
//    no una omisión silenciosa.
const NAV_AREAS = [
  {
    area: null, // Inicio no lleva encabezado de sección, es la puerta de entrada
    items: [{ to: '/', label: 'Inicio', icon: '◆', end: true }],
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
    items: [
      { to: '/fiscal', label: 'Fiscal', icon: '⊛', subItems: FISCAL_TABS },
      { to: '/personal', label: 'Personal', icon: '⯐', subItems: PERSONAL_TABS },
    ],
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
  const { companyName } = useCurrency();
  const { items: pinnedItems, unpin } = usePinnedItems();
  const [hasAccessLevelsAccess, setHasAccessLevelsAccess] = useState(user?.role === 'ADMIN');
  const [hasAffiliateAdminAccess, setHasAffiliateAdminAccess] = useState(false);
  const [hasMembershipAdminAccess, setHasMembershipAdminAccess] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Bug real encontrado en la validación visual de F16 (E18): medido
  // con `scrollWidth` real (no solo una captura a ancho fijo, mismo
  // rigor que ya exigió el bug del Rediseño UX/UI Etapa 3, arriba) —
  // en un teléfono real (390px) el sidebar EXPANDIDO (200-240px) deja
  // menos de 190px para el resto de la pantalla, y el topbar por sí
  // solo ya necesita más de eso — el desborde arrastraba a TODA la
  // página, dejando cifras de dinero cortadas a la mitad. Ningún
  // ancho de topbar por sí solo lo resuelve: un sidebar de 200px+
  // simplemente no cabe en un teléfono, sin importar la preferencia
  // de escritorio del usuario (`isCollapsed`, persistida en el
  // servidor). Se fuerza el modo contraído (mismas clases/JSX ya
  // probadas del modo "solo íconos") en viewports angostos, sin tocar
  // la preferencia real del usuario — al volver a un ancho normal,
  // el sidebar vuelve exactamente a como el usuario lo dejó.
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 640
  );
  useEffect(() => {
    function handleResize() {
      setIsNarrowViewport(window.innerWidth <= 640);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const effectiveCollapsed = isCollapsed || isNarrowViewport;

  // Rediseño UX/UI (Etapa 1) — bug real encontrado y corregido: el
  // flyout de un módulo (`.app-nav-flyout`, `position: absolute; left:
  // 100%`) nunca se veía, ni con el sidebar expandido NI colapsado —
  // `.app-sidebar { overflow: hidden }` y `.app-nav-main { overflow-y:
  // auto }` (que por especificación de CSS fuerza `overflow-x: auto`,
  // nunca `visible`, en cuanto el otro eje no es `visible`) lo recortan
  // SIEMPRE, sin importar el z-index. Confirmado con
  // `document.elementFromPoint` sobre las coordenadas reales del
  // flyout: el punto no pintaba nada — no era un problema de
  // apariencia, el menú contextual nunca fue clicable, ni siquiera en
  // Fase 10 (la verificación de esa fase solo comprobó `isVisible()`/
  // bounding box, que no detectan el recorte de un ancestro). Corregido
  // con un portal a `document.body`, posicionado con las coordenadas
  // reales del disparador (`getBoundingClientRect()`) — el patrón
  // estándar para un menú flotante que debe escapar un contenedor con
  // scroll, sin agregar ninguna librería nueva.
  const [flyout, setFlyout] = useState(null); // { top, left, render }
  const flyoutCloseTimer = useRef(null);

  function openFlyout(key, el, render) {
    clearTimeout(flyoutCloseTimer.current);
    const rect = el.getBoundingClientRect();
    setFlyout({ key, top: rect.top, left: rect.right + 8, render });
  }
  function scheduleCloseFlyout() {
    clearTimeout(flyoutCloseTimer.current);
    flyoutCloseTimer.current = setTimeout(() => setFlyout(null), 150);
  }
  function cancelCloseFlyout() {
    clearTimeout(flyoutCloseTimer.current);
  }
  function closeFlyoutNow() {
    clearTimeout(flyoutCloseTimer.current);
    setFlyout(null);
  }

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

  // Fase 11 (sección 23, "UX de auditoría"): "Auditoría" es
  // estrictamente ADMIN — a diferencia de "Niveles de Acceso", que un
  // Contador con el permiso delegado también puede ver, ver TODO lo
  // que hizo toda la empresa (no solo gestionar usuarios) es más
  // sensible, así que no hereda ese mismo permiso delegado.
  //
  // Rediseño UX/UI (Etapa 1): "Auditoría" se arma acá condicionalmente
  // (rol) pero se inyecta en el grupo CONTROL de `NAV_AREAS`, no en un
  // grupo de Configuración aparte — corrige la ubicación de F11, que la
  // había dejado junto a "Niveles de Acceso" por comodidad de
  // implementación, no porque perteneciera ahí conceptualmente.
  // Fase Afiliados: el flag `isAffiliateProgramAdmin` no viaja en el
  // JWT (ver affiliate-admin.middleware.js — se lee fresco de la base
  // en cada petición del backend), así que acá se pregunta igual que
  // `hasAccessLevelsAccess` pregunta por el permiso delegado — una
  // llamada liviana al entrar, nunca asumida desde el rol.
  useEffect(() => {
    let isMounted = true;
    affiliateAdminApi
      .amIAdmin()
      .then((result) => {
        if (isMounted) setHasAffiliateAdminAccess(result.isAdmin);
      })
      .catch(() => {
        if (isMounted) setHasAffiliateAdminAccess(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Membresía: mismo criterio que afiliados — `isMembershipAdmin` no
  // viaja en el JWT, se pregunta fresco al entrar.
  useEffect(() => {
    let isMounted = true;
    membershipAdminApi
      .amIAdmin()
      .then((result) => {
        if (isMounted) setHasMembershipAdminAccess(result.isAdmin);
      })
      .catch(() => {
        if (isMounted) setHasMembershipAdminAccess(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const configItems = [];
  if (hasAccessLevelsAccess) configItems.push({ to: '/niveles-de-acceso', label: 'Niveles de Acceso', icon: '⚿' });
  // Visible para CUALQUIER rol (nunca gateado por canAccessModule, ver
  // moduleAccess.js — no se agregó 'affiliates' a MODULE_ROLES a
  // propósito): ser afiliado no es un módulo de negocio de la empresa,
  // es un programa aparte al que cualquier persona puede sumarse.
  configItems.push({ to: '/afiliados', label: 'Programa de Afiliados', icon: '◎' });
  if (hasAffiliateAdminAccess) configItems.push({ to: '/admin/afiliados', label: 'Administración de Afiliados', icon: '⚑' });
  // Visible para cualquier rol (consultar el estado de la propia
  // membresía es de solo lectura; solo ADMIN ve el botón de activar
  // dentro de la pantalla misma — ver MembershipPage.jsx).
  configItems.push({ to: '/membresia', label: 'Mi Membresía', icon: '♦' });
  if (hasMembershipAdminAccess) configItems.push({ to: '/admin/membresias', label: 'Administración de Membresías', icon: '⚑' });

  const navAreas = NAV_AREAS.map((group) => {
    if (group.area === 'Control' && user?.role === 'ADMIN') {
      return { ...group, items: [...group.items, { to: '/auditoria', label: 'Auditoría', icon: '▤' }] };
    }
    return group;
  })
    // F17-E8: bug real encontrado probando con un usuario Colaborador
    // real — el menú mostraba Contabilidad/Fiscal/FP&A/Reportes/
    // Análisis Avanzados/Métricas del Negocio aunque el backend
    // (`core/rbac/module-access.js`) nunca le permitiera entrar a
    // ninguno de esos módulos; en el mejor caso (páginas que cargan
    // datos al abrir) el usuario veía de inmediato "No tienes acceso a
    // este módulo con tu rol actual.", pero en Reportes (que no carga
    // nada hasta pulsar "Generar") el formulario completo se veía
    // usable y el bloqueo real solo aparecía después de rellenar todo
    // y enviar — confirmado en vivo (403 real del backend, nunca fue
    // un hueco de seguridad, solo una navegación engañosa). Se filtra
    // acá el menú por el mismo mapa que ya usa el backend.
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessModule(user?.role, moduleKeyForPath(item.to))),
    }))
    .filter((group) => group.items.length > 0);
  if (configItems.length > 0) navAreas.push({ area: 'Configuración', items: configItems });

  // Lista aplanada de todo lo que ya aparece en el menú (módulos +
  // submódulos) — única fuente para NavSearch, nunca una segunda lista
  // declarada aparte que se pudiera desincronizar.
  const searchableItems = navAreas.flatMap((group) => [
    ...group.items.map((item) => ({ to: item.to, label: item.label, groupLabel: group.area })),
    ...group.items.flatMap((item) => (item.subItems || []).map((sub) => ({ to: sub.to, label: sub.label, groupLabel: item.label }))),
  ]);

  return (
    <div className="app-shell">
      <GlobalProgressBar />
      <aside className={`app-sidebar${effectiveCollapsed ? ' is-collapsed' : ''}`}>
        <div className="app-sidebar-brand" title={effectiveCollapsed && companyName ? companyName : undefined}>
          <span className="app-sidebar-mark">A</span>
          {!effectiveCollapsed && (
            <div className="app-sidebar-brand-text">
              <span className="app-sidebar-name">Alarfly</span>
              {companyName && <span className="app-sidebar-company-name">{companyName}</span>}
            </div>
          )}
        </div>

        {pinnedItems.length > 0 && (
          <nav className="app-nav app-nav-pinned">
            {!effectiveCollapsed && <p className="app-nav-section-title">Anclados</p>}
            {pinnedItems.map((item) => (
              <div
                key={item.id}
                className="app-nav-item-wrap app-nav-pinned-row"
                onMouseEnter={(e) =>
                  effectiveCollapsed &&
                  openFlyout(`pin-${item.id}`, e.currentTarget, () => (
                    <>
                      <p className="app-nav-flyout-title">{item.label}</p>
                      <button
                        type="button"
                        className="app-nav-flyout-unpin"
                        onClick={() => {
                          unpin(item.id);
                          closeFlyoutNow();
                        }}
                      >
                        Desanclar
                      </button>
                    </>
                  ))
                }
                onMouseLeave={scheduleCloseFlyout}
              >
                <NavLink
                  to={item.path}
                  title={effectiveCollapsed ? item.label : undefined}
                  aria-label={effectiveCollapsed ? item.label : undefined}
                  className={({ isActive }) => `app-nav-link app-nav-pinned-link${isActive ? ' is-active' : ''}`}
                >
                  <span className="app-nav-icon" aria-hidden="true">
                    ◈
                  </span>
                  {!effectiveCollapsed && <span className="app-nav-pinned-label">{item.label}</span>}
                </NavLink>
                {!effectiveCollapsed && item.suggestUnpin && (
                  <span className="app-nav-pinned-suggest" title="No lo has visitado en un tiempo — considera desanclarlo">
                    ●
                  </span>
                )}
                {!effectiveCollapsed && (
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
              </div>
            ))}
          </nav>
        )}

        <nav className="app-nav app-nav-main">
          {navAreas.map((group) => (
            <div key={group.area || 'inicio'} className="app-nav-area">
              {group.area && !effectiveCollapsed && <p className="app-nav-section-title">{group.area}</p>}
              {group.items.map((item) => {
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const renderFlyout = () => (
                  <>
                    {/* Con el sidebar expandido, el nombre del módulo ya
                        se ve en la fila — repetirlo en el flyout sería
                        ruido; solo hace falta cuando el sidebar está
                        contraído a solo íconos. */}
                    {effectiveCollapsed && <p className="app-nav-flyout-title">{item.label}</p>}
                    <div className="app-nav-flyout-links">
                      {item.subItems.map((sub) => (
                        <NavLink key={sub.to} to={sub.to} className="app-nav-flyout-link" onClick={closeFlyoutNow}>
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  </>
                );
                return (
                  <div
                    key={item.to}
                    className="app-nav-item-wrap"
                    onMouseEnter={(e) => hasSubItems && openFlyout(item.to, e.currentTarget, renderFlyout)}
                    onMouseLeave={scheduleCloseFlyout}
                    onFocus={(e) => hasSubItems && openFlyout(item.to, e.currentTarget, renderFlyout)}
                    onBlur={scheduleCloseFlyout}
                  >
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={effectiveCollapsed ? item.label : undefined}
                      aria-label={effectiveCollapsed ? item.label : undefined}
                      className={({ isActive }) => `app-nav-link${isActive ? ' is-active' : ''}`}
                    >
                      <span className="app-nav-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      {!effectiveCollapsed && item.label}
                    </NavLink>
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <nav className="app-nav app-nav-logout-zone">
          <div
            className="app-nav-item-wrap"
            onMouseEnter={(e) =>
              effectiveCollapsed && openFlyout('logout', e.currentTarget, () => <p className="app-nav-flyout-title">Cerrar sesión</p>)
            }
            onMouseLeave={scheduleCloseFlyout}
          >
            <button
              type="button"
              className="app-nav-link app-nav-logout"
              onClick={logout}
              title={effectiveCollapsed ? 'Cerrar sesión' : undefined}
              aria-label={effectiveCollapsed ? 'Cerrar sesión' : undefined}
            >
              <Icon name="logout" size={18} />
              {!effectiveCollapsed && 'Cerrar sesión'}
            </button>
          </div>
        </nav>

        <div className="app-sidebar-footer">
          {!effectiveCollapsed && <p className="app-sidebar-hint">Alarfly · Plataforma financiera</p>}
          {/* En un teléfono real no hay nada que expandir (el sidebar
              se fuerza contraído por falta de espacio, ver arriba) —
              mostrar el botón ahí lo dejaría pareciendo roto (clic sin
              ningún efecto visible), así que se oculta solo en ese caso. */}
          {!isNarrowViewport && (
            <button
              type="button"
              className="app-sidebar-collapse-toggle"
              onClick={toggleCollapsed}
              title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
              aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              {isCollapsed ? '»' : '«'}
            </button>
          )}
        </div>
      </aside>

      <div className="app-main">
        <TrialBanner />
        <header className="app-topbar">
          <NavSearch items={searchableItems} />
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
            <button type="button" className="app-topbar-logout" onClick={logout} aria-label="Cerrar sesión">
              <Icon name="logout" size={16} />
              <span className="app-topbar-logout-label">Cerrar sesión</span>
            </button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <QuickCreateFab />
      <ContextualHelpButton />

      {flyout &&
        createPortal(
          <div
            className="app-nav-flyout app-nav-flyout-portal"
            style={{ top: flyout.top, left: flyout.left }}
            onMouseEnter={cancelCloseFlyout}
            onMouseLeave={scheduleCloseFlyout}
          >
            {flyout.render()}
          </div>,
          document.body
        )}
    </div>
  );
}
