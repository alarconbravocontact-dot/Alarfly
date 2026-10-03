import { Outlet, Link } from 'react-router-dom';
import { useAffiliateAuth } from '../../context/AffiliateAuthContext';
import './AffiliateLayout.css';

// Caparazón propio y minimalista para el tablero del afiliado —
// deliberadamente NO reutiliza AppLayout (que asume una sesión de
// empresa real: menú de 9 módulos, selector de moneda, RBAC por rol,
// etc. — nada de eso aplica a un afiliado). Reutiliza sí los mismos
// tokens de theme.css y el mismo patrón de topbar simple.
export default function AffiliateLayout() {
  const { affiliate, logout } = useAffiliateAuth();

  return (
    <div className="affiliate-shell">
      <header className="affiliate-topbar">
        <Link to="/afiliados/panel" className="affiliate-topbar-brand">
          <span className="affiliate-topbar-mark">A</span>
          <span>Alarfly · Afiliados</span>
        </Link>
        <div className="affiliate-topbar-user">
          <span className="affiliate-topbar-name">{affiliate?.name}</span>
          <button type="button" className="btn btn-ghost btn-small" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="affiliate-content">
        <Outlet />
      </main>
    </div>
  );
}
