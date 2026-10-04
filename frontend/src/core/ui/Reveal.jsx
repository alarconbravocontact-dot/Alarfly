import { useEffect, useRef, useState } from 'react';
import './Reveal.css';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Prompt 2 (UX): animación de aparición al hacer scroll — discreta
// (fade + un desplazamiento corto de 12px, nunca parallax ni efectos
// pesados), rápida (320ms), y SIEMPRE desactivada si el usuario pidió
// `prefers-reduced-motion: reduce` (se revela de inmediato, sin
// transición, en vez de ignorar esa preferencia de accesibilidad).
// Un solo `IntersectionObserver` por instancia, nunca un listener de
// `scroll` (que dispara en cada frame y es la causa típica de "layout
// thrashing" en animaciones de scroll) — se desconecta solo apenas el
// elemento aparece una vez, no vuelve a observar.
export default function Reveal({ children, as: Component = 'div', delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion() || visible) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Component
      ref={ref}
      className={`ui-reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Component>
  );
}
