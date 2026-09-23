import { useEffect, useRef, useState } from 'react';
import './RecordDrawer.css';

// Panel deslizable (drawer) genérico desde el borde derecho (Feature R):
// muestra una previsualización resumida de un registro sin navegar a una
// pantalla nueva — el proyecto no tiene rutas por registro (cada módulo
// es una sola pantalla de lista), así que "expandir a pantalla completa"
// no navega a ninguna parte: hace que el propio panel ocupe todo el
// ancho y muestre `fullDetail` en vez de `summary`.
//
// Innovación pedida explícitamente: mientras el panel está abierto, las
// flechas ↑/↓ del teclado navegan entre los registros consecutivos de la
// lista que lo abrió (`onNavigate(direction)`), sin cerrar el panel.
export default function RecordDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  summary,
  fullDetail,
  footer,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) setIsExpanded(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(event) {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (isTyping || !onNavigate) return;
      if (event.key === 'ArrowDown' && hasNext) {
        event.preventDefault();
        onNavigate(1);
      } else if (event.key === 'ArrowUp' && hasPrev) {
        event.preventDefault();
        onNavigate(-1);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNavigate, hasPrev, hasNext]);

  if (!isOpen) return null;

  return (
    <div className="record-drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`record-drawer${isExpanded ? ' is-expanded' : ''}`} ref={panelRef}>
        <div className="record-drawer-header">
          <div>
            <p className="record-drawer-title">{title}</p>
            {subtitle && <p className="record-drawer-subtitle">{subtitle}</p>}
          </div>
          <div className="record-drawer-header-actions">
            {onNavigate && (
              <span className="record-drawer-nav">
                <button type="button" className="btn btn-small" onClick={() => onNavigate(-1)} disabled={!hasPrev} title="Registro anterior (↑)">
                  ↑
                </button>
                <button type="button" className="btn btn-small" onClick={() => onNavigate(1)} disabled={!hasNext} title="Registro siguiente (↓)">
                  ↓
                </button>
              </span>
            )}
            {fullDetail && (
              <button type="button" className="btn btn-small" onClick={() => setIsExpanded((v) => !v)}>
                {isExpanded ? 'Vista resumida' : 'Expandir a pantalla completa'}
              </button>
            )}
            <button type="button" className="record-drawer-close" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
        </div>
        <div className="record-drawer-body">{isExpanded && fullDetail ? fullDetail : summary}</div>
        {footer && <div className="record-drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}
