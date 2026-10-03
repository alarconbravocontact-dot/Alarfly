import { Link } from 'react-router-dom';
import Icon from '../../core/ui/Icon';
import './LandingPage.css';

// Fase Landing — construida directamente sobre LANDING_MASTER_STRATEGY.md
// (raíz del repositorio): mismo copy, misma estructura (sección 11),
// mismo CTA ya resuelto ("Empieza gratis", sección 9 actualizada),
// mismos claims permitidos (sección 13 — nunca se promete IA, nunca se
// inventa un testimonio/cliente/métrica de uso). Reutiliza
// EXACTAMENTE los tokens reales de theme.css (sección 14) — ningún
// color/tipografía nuevo para esta pantalla.

const CAPABILITIES = [
  {
    icon: 'chart',
    title: 'Ventas e inventario conectados',
    body: 'Cada venta actualiza tu stock, tu contabilidad y tu cuenta por cobrar al mismo tiempo — sin doble trabajo.',
  },
  {
    icon: 'clock',
    title: 'Previsión de Liquidez',
    body: 'Mira las próximas 8 semanas con tus facturas y deudas reales — no solo el saldo de hoy.',
  },
  {
    icon: 'users',
    title: 'Cobranza que se escala sola',
    body: 'Recordatorio, aviso firme, y bloqueo automático si un cliente se atrasa demasiado.',
  },
  {
    icon: 'inventory',
    title: 'Inventario con trazabilidad real',
    body: 'Multi-almacén, costeo FIFO/LIFO/Promedio Ponderado, lotes y vencimientos bajo control.',
  },
  {
    icon: 'shield',
    title: 'Permisos y auditoría reales',
    body: '4 roles de negocio, verificación en dos pasos, y cada acción sensible queda registrada.',
  },
  {
    icon: 'chart',
    title: '16 análisis financieros automáticos',
    body: 'Rentabilidad, punto de equilibrio, flujo de caja y más — explicados en lenguaje simple.',
  },
];

const STEPS = [
  {
    n: '1',
    title: 'Registra una venta o una compra',
    body: 'Como ya lo haces hoy — con tu cliente, tu producto, tu monto.',
  },
  {
    n: '2',
    title: 'Alarfly actualiza todo solo',
    body: 'Tu inventario, tu contabilidad y tu flujo de caja se mueven automáticamente, sin pasos extra.',
  },
  {
    n: '3',
    title: 'Ves el impacto real al instante',
    body: 'Cuánto tienes, quién te debe, y si realmente estás ganando — sin esperar a fin de mes.',
  },
];

const FAQS = [
  {
    q: '¿Necesito saber de contabilidad para usarlo?',
    a: 'No — cada término técnico tiene una explicación en una frase, justo donde lo necesitas.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Sí — autenticación con verificación en dos pasos, permisos por rol, y cada acción sensible queda registrada con quién la hizo y cuándo.',
  },
  {
    q: '¿Puedo probarlo antes de pagar?',
    a: 'Sí — 7 días de prueba gratis, sin tarjeta. Creas tu cuenta y empiezas a usarlo de inmediato.',
  },
  {
    q: '¿Sirve si tengo inventario, varias sucursales o varias empresas?',
    a: 'Sí — multi-almacén, multi-sucursal y multiempresa existen y están probados.',
  },
  {
    q: '¿Trabaja con bolívares?',
    a: 'Sí — con tasa oficial BCV y soporte para USD/EUR, pensado para el día a día de una pyme venezolana.',
  },
  {
    q: '¿Qué pasa si mi negocio crece y necesito más usuarios?',
    a: 'Los roles tienen cupos (Administrador sin límite, Contador hasta 3, Financiero hasta 4, Colaborador hasta 8) — suficiente para un equipo pyme típico.',
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <span className="landing-brand-mark">A</span>
            <span className="landing-brand-name">Alarfly</span>
          </div>
          <nav className="landing-nav-links">
            <a href="#producto">Producto</a>
            <a href="#precio">Precio</a>
            <a href="#faq">Preguntas</a>
          </nav>
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

      <main>
        {/* Hero */}
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <h1 className="landing-hero-title">
              El dinero de tu negocio, bajo control — <span className="landing-accent">sin ser contador.</span>
            </h1>
            <p className="landing-hero-subtitle">
              Ventas, compras, inventario y finanzas conectados en un solo lugar. Cada término técnico, explicado en
              una frase.
            </p>
            <div className="landing-hero-actions">
              <Link to="/registro" className="btn btn-primary btn-large">
                Empieza gratis
              </Link>
              <a href="#producto" className="btn btn-ghost btn-large">
                Ver cómo funciona
              </a>
            </div>
            <p className="landing-hero-support">7 días de prueba, sin tarjeta.</p>
          </div>

          {/* Vista previa del producto real — mismas etiquetas y estructura
              que el Panel principal real, simplificada para esta sección
              (no es una captura literal; ningún dato ni capacidad mostrada
              acá es inventada, todas existen en el producto real). */}
          <div className="landing-preview" aria-hidden="true">
            <div className="landing-preview-card">
              <div className="landing-preview-row">
                <div className="landing-preview-stat">
                  <span className="landing-preview-label">CAJA DISPONIBLE</span>
                  <span className="landing-preview-value">4.280,00 US$</span>
                </div>
                <div className="landing-preview-stat">
                  <span className="landing-preview-label">CUENTAS POR COBRAR</span>
                  <span className="landing-preview-value landing-preview-positive">1.150,00 US$</span>
                </div>
              </div>
              <div className="landing-preview-chart">
                <div className="landing-preview-bar" style={{ height: '35%' }} />
                <div className="landing-preview-bar" style={{ height: '55%' }} />
                <div className="landing-preview-bar" style={{ height: '40%' }} />
                <div className="landing-preview-bar" style={{ height: '70%' }} />
                <div className="landing-preview-bar" style={{ height: '58%' }} />
                <div className="landing-preview-bar landing-preview-bar-accent" style={{ height: '85%' }} />
              </div>
              <div className="landing-preview-row">
                <span className="landing-preview-chip">Previsión de Liquidez — 8 semanas</span>
              </div>
            </div>
          </div>
        </section>

        {/* Problema */}
        <section className="landing-section landing-section-alt">
          <div className="landing-section-inner landing-narrow">
            <h2>Llevar las finanzas de tu negocio no debería sentirse así</h2>
            <div className="landing-problem-grid">
              <p>Hojas de cálculo que nadie actualiza a tiempo.</p>
              <p>No saber si realmente estás ganando o perdiendo dinero.</p>
              <p>Clientes que se te olvidan hasta que ya es tarde para cobrarles.</p>
              <p>Depender de alguien externo para entender un número.</p>
            </div>
          </div>
        </section>

        {/* Propuesta de valor */}
        <section className="landing-section">
          <div className="landing-section-inner landing-narrow">
            <h2>Todo conectado, explicado en lenguaje simple</h2>
            <p className="landing-section-lead">
              Alarfly reúne ventas, compras, inventario y contabilidad en un solo sistema — para que sepas, sin ser
              experto, cuánto tienes, quién te debe, y si tu negocio está ganando de verdad.
            </p>
          </div>
        </section>

        {/* Capacidades */}
        <section className="landing-section landing-section-alt" id="producto">
          <div className="landing-section-inner">
            <h2>Lo que Alarfly hace por tu negocio</h2>
            <div className="landing-capabilities-grid">
              {CAPABILITIES.map((c) => (
                <div className="landing-capability-card" key={c.title}>
                  <div className="landing-capability-icon">
                    <Icon name={c.icon} size={22} />
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="landing-section">
          <div className="landing-section-inner landing-narrow">
            <h2>Cómo funciona</h2>
            <div className="landing-steps">
              {STEPS.map((s) => (
                <div className="landing-step" key={s.n}>
                  <span className="landing-step-number">{s.n}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Confianza */}
        <section className="landing-section landing-section-alt">
          <div className="landing-section-inner landing-narrow">
            <h2>Un producto real, auditado de punta a punta</h2>
            <div className="landing-trust-grid">
              <div className="landing-trust-item">
                <Icon name="shield" size={20} />
                <div>
                  <h3>Seguridad real</h3>
                  <p>Verificación en dos pasos, contraseñas cifradas, sesiones que puedes cerrar en remoto.</p>
                </div>
              </div>
              <div className="landing-trust-item">
                <Icon name="check" size={20} />
                <div>
                  <h3>Auditoría de verdad</h3>
                  <p>Cada operación sensible queda registrada: quién, qué y cuándo.</p>
                </div>
              </div>
              <div className="landing-trust-item">
                <Icon name="chart" size={20} />
                <div>
                  <h3>Integridad financiera verificada</h3>
                  <p>Tu contabilidad nunca queda descuadrada — comprobado asiento por asiento.</p>
                </div>
              </div>
              <div className="landing-trust-item">
                <Icon name="users" size={20} />
                <div>
                  <h3>Permisos reales por rol</h3>
                  <p>No solo se ocultan botones — cada acción se valida en el servidor.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="landing-section" id="precio">
          <div className="landing-section-inner landing-narrow">
            <h2>Un solo plan, sin letra pequeña</h2>
            <div className="landing-pricing-card">
              <p className="landing-price">
                $25<span>/mes</span>
              </p>
              <p className="landing-price-sub">7 días de prueba gratis, sin tarjeta.</p>
              <ul className="landing-price-list">
                <li>Todos los módulos incluidos — sin límites artificiales por plan.</li>
                <li>Ventas, compras, inventario, contabilidad y reportes.</li>
                <li>Hasta 16 usuarios de equipo (según rol).</li>
              </ul>
              <Link to="/registro" className="btn btn-primary btn-large">
                Empieza gratis
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="landing-section landing-section-alt" id="faq">
          <div className="landing-section-inner landing-narrow">
            <h2>Preguntas frecuentes</h2>
            <div className="landing-faq">
              {FAQS.map((f) => (
                <details className="landing-faq-item" key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="landing-cta-final">
          <div className="landing-section-inner landing-narrow">
            <h2>Empieza a controlar las finanzas de tu negocio hoy</h2>
            <p>7 días de prueba gratis. Sin tarjeta, sin compromiso.</p>
            <Link to="/registro" className="btn btn-primary btn-large">
              Empieza gratis
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-section-inner landing-footer-inner">
          <div className="landing-brand">
            <span className="landing-brand-mark">A</span>
            <span className="landing-brand-name">Alarfly</span>
          </div>
          <p className="landing-footer-copy">Gestión financiera integral para pymes.</p>
          <Link to="/acceso" className="landing-footer-link">
            Iniciar sesión
          </Link>
        </div>
      </footer>
    </div>
  );
}
