import { useIncognito } from '../../context/IncognitoContext';
import Icon from './Icon';
import './IncognitoToggle.css';

// Ícono de ojo en la barra superior (Feature V): activa/desactiva el
// modo incógnito global. Atajo de teclado: Ctrl/Cmd+Shift+H.
export default function IncognitoToggle() {
  const { isIncognito, toggle } = useIncognito();

  return (
    <button
      type="button"
      className={`incognito-toggle${isIncognito ? ' is-active' : ''}`}
      onClick={toggle}
      title={`${isIncognito ? 'Mostrar' : 'Ocultar'} montos (Ctrl+Shift+H)`}
      aria-pressed={isIncognito}
      aria-label={isIncognito ? 'Mostrar montos' : 'Ocultar montos (modo incógnito)'}
    >
      <Icon name={isIncognito ? 'eye-off' : 'eye'} label={isIncognito ? 'Mostrar montos' : 'Ocultar montos'} />
    </button>
  );
}
