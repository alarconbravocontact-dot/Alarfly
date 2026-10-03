import { Link } from 'react-router-dom';
import Icon from '../core/ui/Icon';
import Seo from '../core/ui/Seo';
import '../pages/landing/LandingPage.css';
import './NotFoundPage.css';

// Página 404 real (Cierre Web/SEO): antes, cualquier ruta inexistente
// redirigía silenciosamente a "/" (`<Route path="*" element={<Navigate
// to="/" replace />} />`) — nunca existió un estado de error visible.
// Se reemplaza por esta pantalla, con `noIndex` explícito (una 404
// nunca debe indexarse) y el mismo lenguaje visual de la Landing
// (`.landing*`), sin crear una segunda identidad para un solo caso de
// error.
export default function NotFoundPage() {
  return (
    <div className="landing">
      <Seo title="Página no encontrada" noIndex />
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-brand" style={{ textDecoration: 'none' }}>
            <span className="landing-brand-mark">A</span>
            <span className="landing-brand-name">Alarfly</span>
          </Link>
        </div>
      </header>

      <main className="notfound-main">
        <div className="notfound-icon">
          <Icon name="search" size={40} />
        </div>
        <p className="notfound-code">404</p>
        <h1>Página no encontrada</h1>
        <p className="notfound-body">
          La dirección a la que intentaste llegar no existe o ya no está disponible. Revisa que esté bien escrita, o
          vuelve al inicio.
        </p>
        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary btn-large">
            Volver al inicio
          </Link>
          <Link to="/contacto" className="btn btn-ghost btn-large">
            ¿Necesitas ayuda? Escríbenos
          </Link>
        </div>
      </main>
    </div>
  );
}
