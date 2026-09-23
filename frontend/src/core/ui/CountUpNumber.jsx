import { useEffect, useRef, useState } from 'react';

// "Totales progresivos": en vez de que un monto o KPI aparezca de golpe
// apenas responde el backend, sube visiblemente desde 0 (o desde su
// valor anterior, si ya se había mostrado uno) hasta la cifra real —
// puramente decorativo, nunca inventa un valor intermedio que no sea
// matemáticamente parte del camino hacia el número final. `format`
// recibe el número intermedio (puede tener decimales) y decide cómo
// mostrarlo (moneda, "N meses", entero, etc.) — este componente no
// sabe nada de dinero ni de ningún otro dominio.
export default function CountUpNumber({ value, format, durationMs = 700 }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const from = fromRef.current;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const current = from + (target - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return <>{format ? format(display) : Math.round(display)}</>;
}
