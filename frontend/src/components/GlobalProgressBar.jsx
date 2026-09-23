import { useEffect, useRef, useState } from 'react';
import { subscribeProgressBar } from '../utils/progressBarBus';
import './GlobalProgressBar.css';

// Barra de progreso global (estilo "trickle", como la de GitHub/YouTube
// al navegar): se muestra fija arriba de toda la pantalla mientras hay
// una operación pesada real en curso (exportar un PDF/Excel, analizar
// un archivo de importación grande, confirmar un lote de importación).
// No mide el progreso real byte a byte — ninguna de esas respuestas
// trae ese dato — así que avanza rápido al inicio y luego más lento
// hacia el 90%, y solo llega a 100% cuando la operación realmente
// termina, igual que el patrón ya conocido de NProgress.
//
// Innovación pedida explícitamente: si se disparan varias operaciones
// pesadas al mismo tiempo (ej. exportar un reporte mientras un
// asistente de importación todavía está analizando un archivo), la
// barra NO se reinicia ni parpadea con cada una — se mantiene visible
// y suma una insignia "N en curso" hasta que la última termina.
export default function GlobalProgressBar() {
  const [activeCount, setActiveCount] = useState(0);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickleIntervalRef = useRef(null);
  const hideTimeoutRef = useRef(null);

  useEffect(() => subscribeProgressBar(setActiveCount), []);

  useEffect(() => {
    clearTimeout(hideTimeoutRef.current);
    clearInterval(trickleIntervalRef.current);

    if (activeCount > 0) {
      setVisible(true);
      setWidth((current) => (current < 20 ? 20 : current));
      trickleIntervalRef.current = setInterval(() => {
        setWidth((current) => (current < 90 ? current + (90 - current) * 0.15 : current));
      }, 250);
    } else {
      setWidth(100);
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 350);
    }

    return () => {
      clearTimeout(hideTimeoutRef.current);
      clearInterval(trickleIntervalRef.current);
    };
  }, [activeCount]);

  if (!visible) return null;

  return (
    <div
      className="global-progress-bar"
      role="status"
      aria-live="polite"
      aria-label={activeCount > 1 ? `${activeCount} operaciones en curso` : 'Operación en curso'}
    >
      <div className="global-progress-bar-fill" style={{ width: `${width}%` }} />
      {activeCount > 1 && <span className="global-progress-bar-badge">{activeCount} en curso</span>}
    </div>
  );
}
