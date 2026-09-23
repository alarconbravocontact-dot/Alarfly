import { useState } from 'react';
import './HelpTooltip.css';

// Ícono "?" que muestra una explicación corta en lenguaje simple al
// hacer clic (no solo al pasar el mouse, para que funcione igual en
// pantallas táctiles). Se usa junto a cualquier campo o concepto que
// use una palabra técnica (ej: "FIFO", "débito", "conciliación").
export default function HelpTooltip({ text }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="help-tooltip">
      <button
        type="button"
        className="help-tooltip-trigger"
        onClick={() => setIsOpen((v) => !v)}
        onBlur={() => setIsOpen(false)}
        aria-label="Ayuda"
        aria-expanded={isOpen}
      >
        ?
      </button>
      {isOpen && (
        <span className="help-tooltip-popover" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
