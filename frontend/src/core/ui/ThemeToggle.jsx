import { useTheme } from '../../context/ThemeContext';
import Icon from './Icon';
import './ThemeToggle.css';

const CYCLE = ['dark', 'light', 'auto'];
const LABELS = { dark: 'Oscuro', light: 'Claro', auto: 'Automático (según tu sistema)' };

// Prompt 2 (UX/Tema): selector de tema reutilizable — mismo
// `useTheme()`/mismo juego de tokens que ya usa Mi Cuenta >
// Preferencias (un <select> con las 3 mismas opciones), solo que este
// botón funciona TAMBIÉN sin sesión (Landing, Privacidad, Términos,
// Contacto, 404) — ver ThemeContext.jsx. Mismo patrón de botón-ícono
// que IncognitoToggle: ciclo de un clic (oscuro → claro → automático →
// oscuro…), con aria-pressed/aria-label describiendo el estado
// EFECTIVO actual y el próximo al que se pasará.
export default function ThemeToggle() {
  const { rawTheme, effectiveTheme, setTheme } = useTheme();

  function handleClick() {
    const nextIndex = (CYCLE.indexOf(rawTheme) + 1) % CYCLE.length;
    setTheme(CYCLE[nextIndex]);
  }

  const icon = rawTheme === 'auto' ? 'theme-auto' : effectiveTheme === 'light' ? 'sun' : 'moon';
  const nextIndex = (CYCLE.indexOf(rawTheme) + 1) % CYCLE.length;

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      title={`Tema: ${LABELS[rawTheme]}. Clic para cambiar a ${LABELS[CYCLE[nextIndex]]}.`}
      aria-label={`Tema actual: ${LABELS[rawTheme]}. Cambiar a ${LABELS[CYCLE[nextIndex]]}.`}
    >
      <Icon name={icon} label="Tema" />
    </button>
  );
}
