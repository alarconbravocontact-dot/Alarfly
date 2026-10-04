import { useEffect, useState } from 'react';
import Icon from './Icon';
import './BackToTop.css';

const SHOW_AFTER_PX = 480;

// Prompt 2 (UX): botón "Volver arriba" — aparece/desaparece según el
// scroll (un solo listener, protegido con `requestAnimationFrame` para
// no disparar el cálculo de visibilidad en cada evento de scroll, que
// puede llegar decenas de veces por segundo), transición suave de
// opacidad, funciona con teclado (es un <button> real, no un <div>
// con onClick), y respeta `prefers-reduced-motion` en el propio scroll.
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    function handleScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setVisible(window.scrollY > SHOW_AFTER_PX);
        ticking = false;
      });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function handleClick() {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  return (
    <button
      type="button"
      className={`back-to-top${visible ? ' is-visible' : ''}`}
      onClick={handleClick}
      aria-label="Volver arriba"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <Icon name="arrow-up" label="Volver arriba" />
    </button>
  );
}
