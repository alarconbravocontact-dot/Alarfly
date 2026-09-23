import { Link } from 'react-router-dom';
import './Breadcrumb.css';

/**
 * Breadcrumb de navegación reutilizable — usado tanto para la ruta
 * analítica de un drill-down (ej. "Panel principal › Egresos › julio
 * 2026") como, más adelante, para cualquier ruta jerárquica real (ej.
 * el árbol del plan de cuentas). Cada nivel es clicable salvo el
 * último (la pantalla actual), para volver a cualquier nivel anterior
 * sin perder de vista cómo se llegó ahí.
 *
 * `items`: [{ label, to?, state? }] — sin `to`, el nivel se muestra
 * como texto plano (el nivel actual).
 */
export default function Breadcrumb({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <nav className="ui-breadcrumb" aria-label="Ruta de navegación">
      {items.map((item, index) => (
        <span key={index} className="ui-breadcrumb-item">
          {item.to ? (
            <Link className="ui-breadcrumb-link" to={item.to} state={item.state}>
              {item.label}
            </Link>
          ) : (
            <span className="ui-breadcrumb-current">{item.label}</span>
          )}
          {index < items.length - 1 && (
            <span className="ui-breadcrumb-sep" aria-hidden="true">
              ›
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
