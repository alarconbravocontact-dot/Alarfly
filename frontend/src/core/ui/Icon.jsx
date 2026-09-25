import { useIconLabel } from '../../context/IconLabelContext';
import './Icon.css';

// Sistema de iconografía consistente (Feature Y): un solo set de
// íconos, mismo grosor de línea (1.75) y mismo tamaño base (20px),
// dibujados a mano en SVG trazado — sin librería externa, mismo
// criterio ya usado para los gráficos del proyecto (ningún ícono nuevo
// agrega una dependencia). Documentado como parte del sistema de
// diseño en frontend/DESIGN_SYSTEM.md, no elegido pantalla por
// pantalla: toda pantalla nueva que necesite un ícono agrega su `path`
// acá, en vez de un emoji o un glifo suelto dentro de su propio
// componente. El ícono en sí siempre queda decorativo
// (`aria-hidden="true"`) — el nombre accesible lo sigue dando el
// elemento que lo envuelve (`aria-label`/`title` del botón), tal como
// ya hacían `IncognitoToggle`/`NotificationCenter`/`QuickCreateFab`
// antes de esta pieza; acá solo se agrega, opcionalmente, la etiqueta
// de texto VISIBLE del modo "principiante".
const PATHS = {
  bell: 'M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z M9.5 18a2.5 2.5 0 0 0 5 0',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'eye-off':
    'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M7.4 7.5C4.9 9 3.4 11.3 2 12c0 0 1.2 2.4 3.9 4.5M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.1 3.9',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 13l4 4L19 7',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  // Rediseño UX/UI (Etapa 1): búsqueda de navegación en el topbar.
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35',
};

const BASE_SIZE = 20;

export default function Icon({ name, label, size = BASE_SIZE, className = '' }) {
  const { beginnerMode } = useIconLabel();
  const path = PATHS[name];
  if (!path) return null;

  return (
    <span className={`ui-icon-wrap${className ? ` ${className}` : ''}`}>
      <svg
        className="ui-icon"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
      {beginnerMode && label && <span className="ui-icon-label">{label}</span>}
    </span>
  );
}
