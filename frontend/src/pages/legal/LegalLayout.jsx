import { Link } from 'react-router-dom';
import '../landing/LandingPage.css';
import './LegalLayout.css';

// Cierre Web/SEO: reutiliza EXACTAMENTE la misma estructura de
// navegación/pie de página que ya existe en la Landing (clases
// `.landing`/`.landing-nav`/`.landing-footer`, ver LandingPage.css) —
// una página legal no es un diseño aparte, es la misma identidad
// visual de Alarfly con una sola columna de texto en medio. No se creó
// un segundo sistema de diseño ni se duplicó ninguna regla CSS.
export default function LegalLayout({ title, updatedAt, children }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-brand" style={{ textDecoration: 'none' }}>
            <span className="landing-brand-mark">A</span>
            <span className="landing-brand-name">Alarfly</span>
          </Link>
          <div className="landing-nav-actions">
            <Link to="/acceso" className="landing-nav-login">
              Iniciar sesión
            </Link>
            <Link to="/registro" className="btn btn-primary">
              Empieza gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="legal-main">
        <div className="legal-article">
          <h1>{title}</h1>
          {updatedAt && <p className="legal-updated">Última actualización: {updatedAt}</p>}
          {children}
        </div>
      </main>

      <footer className="landing-footer">
        <div className="landing-section-inner landing-footer-inner">
          <div className="landing-brand">
            <span className="landing-brand-mark">A</span>
            <span className="landing-brand-name">Alarfly</span>
          </div>
          <p className="landing-footer-copy">Gestión financiera integral para pymes.</p>
          <div className="landing-footer-links">
            <Link to="/privacidad" className="landing-footer-link">
              Privacidad
            </Link>
            <Link to="/terminos" className="landing-footer-link">
              Términos
            </Link>
            <Link to="/contacto" className="landing-footer-link">
              Contacto
            </Link>
            <Link to="/afiliados" className="landing-footer-link">
              Gana dinero recomendando Alarfly
            </Link>
            <Link to="/acceso" className="landing-footer-link">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
