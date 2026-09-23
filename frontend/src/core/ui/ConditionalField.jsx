import './ConditionalField.css';

// Muestra/oculta un grupo de campos con una transición suave (nunca un
// salto brusco) — genérico y reutilizable: la pantalla que lo usa
// decide QUÉ condición evaluar (normalmente con
// `utils/conditionEvaluator.js`, el mismo evaluador seguro que ya usa
// el constructor de filtros — nunca si/else repetido formulario por
// formulario) y solo le pasa el resultado ya evaluado (`show`).
export default function ConditionalField({ show, children }) {
  return (
    <div
      className={`conditional-field${show ? '' : ' is-hidden'}`}
      aria-hidden={!show}
      inert={!show}
    >
      <div className="conditional-field-inner">{children}</div>
    </div>
  );
}
