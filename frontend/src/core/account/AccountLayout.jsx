import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import ModuleBreadcrumb from '../ui/ModuleBreadcrumb';

const TABS = [
  { to: '/mi-cuenta/perfil', label: 'Perfil' },
  { to: '/mi-cuenta/seguridad', label: 'Seguridad' },
  { to: '/mi-cuenta/rol-y-permisos', label: 'Mi rol y permisos' },
  { to: '/mi-cuenta/preferencias', label: 'Preferencias' },
  { to: '/mi-cuenta/notificaciones', label: 'Notificaciones' },
  { to: '/mi-cuenta/actividad', label: 'Mi actividad' },
  { to: '/mi-cuenta/firma', label: 'Firma de aprobación' },
  { to: '/mi-cuenta/zona-de-riesgo', label: 'Zona de riesgo' },
];

export default function AccountLayout() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="page">
      <ModuleBreadcrumb moduleLabel="Mi Cuenta" tabs={TABS} />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Mi Cuenta</h1>
          <p className="page-subtitle">Tus datos, tu seguridad y tus preferencias en Alarfly.</p>
        </div>
        <button type="button" className="btn btn-small" onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? 'Cerrar ayuda' : '¿Necesitas ayuda?'}
        </button>
      </div>

      {showHelp && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>
            En cada pantalla de la aplicación vas a ver un ícono <strong>"?"</strong> junto a los campos con
            palabras técnicas — haz clic para una explicación simple. Si algo no funciona como esperas, revisa
            primero <strong>Seguridad</strong> (tu sesión, tu contraseña) o <strong>Mi rol y permisos</strong> (a
            qué partes del sistema puedes entrar). Para cualquier otra duda, contacta al Administrador de tu
            empresa desde <strong>Junta</strong>, en el Panel principal.
          </p>
        </div>
      )}

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
