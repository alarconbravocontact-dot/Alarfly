import { useState } from 'react';
import './Disclosure.css';

// Rediseño UX/UI (Etapa 3, "revelación progresiva" — la pantalla
// inicial muestra lo necesario, los detalles avanzados aparecen cuando
// realmente se necesitan). Genérico y sin estado persistido a
// propósito: a diferencia de `ExecutiveSummaryCards` (que recuerda
// contraído/expandido por usuario vía `core/panel-preferences`, para
// un panel de datos que se vuelve a visitar), esto es una sección de
// FORMULARIO que casi nunca hace falta tocar — siempre arranca
// colapsada, sin pedir nada al servidor. Mismo glifo ▸/▾ que ya usa
// `ExecutiveSummaryCards` para no introducir un segundo lenguaje
// visual de "colapsar/expandir".
export default function Disclosure({ label, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="ui-disclosure">
      <button type="button" className="ui-disclosure-toggle" onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen}>
        <span className="ui-disclosure-chevron">{isOpen ? '▾' : '▸'}</span>
        {label}
      </button>
      {isOpen && <div className="ui-disclosure-body">{children}</div>}
    </div>
  );
}
