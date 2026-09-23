import { useEffect, useState } from 'react';
import { panelPreferencesApi } from '../../api/panel-preferences';
import Sparkline from './Sparkline';
import CountUpNumber from './CountUpNumber';
import './ExecutiveSummaryCards.css';

// Tarjetas de resumen ejecutivo, colapsables y reutilizables por
// cualquier módulo: `panelKey` identifica el panel para recordar
// contraído/expandido por usuario (core/panel-preferences, nunca
// compartido entre usuarios). `cards`: [{key, label, displayValue,
// numericValue?, format?, tone?, sparklineValues?: number[]}] — la
// pantalla que lo usa decide qué números mostrar y cómo formatearlos,
// este componente no sabe nada de facturas ni de ningún otro dato de
// negocio. Si la tarjeta trae `numericValue` + `format` (totales
// progresivos), el monto sube animado desde 0 hasta su valor real en
// vez de aparecer de golpe; si no los trae, se usa `displayValue` tal
// cual (compatibilidad hacia atrás, sin animación).
export default function ExecutiveSummaryCards({ panelKey, title, cards, isLoading, error }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    panelPreferencesApi
      .get(panelKey)
      .then((pref) => {
        if (isMounted) setIsCollapsed(pref.isCollapsed);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [panelKey]);

  function toggle() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    panelPreferencesApi.set(panelKey, next).catch(() => {});
  }

  return (
    <div className="exec-summary">
      <button type="button" className="exec-summary-toggle" onClick={toggle} aria-expanded={!isCollapsed}>
        <span className="exec-summary-chevron">{isCollapsed ? '▸' : '▾'}</span>
        <span>{title}</span>
      </button>
      {!isCollapsed && (
        <div className="exec-summary-cards">
          {isLoading && <p className="text-muted">Cargando…</p>}
          {!isLoading && error && <p className="alert-box alert-box-error">{error}</p>}
          {!isLoading &&
            !error &&
            cards.map((c) => (
              <div className="exec-summary-card" key={c.key}>
                <span className="exec-summary-card-label">{c.label}</span>
                <span className={`exec-summary-card-value${c.tone ? ` exec-summary-card-value--${c.tone}` : ''}`}>
                  {c.numericValue !== undefined && c.format ? (
                    <CountUpNumber value={c.numericValue} format={c.format} />
                  ) : (
                    c.displayValue
                  )}
                </span>
                {c.sparklineValues && c.sparklineValues.length > 1 && (
                  <Sparkline values={c.sparklineValues} tone={c.tone} />
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
