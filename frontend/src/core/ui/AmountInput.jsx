import { useMemo } from 'react';
import { evaluateMathExpression, isExpression, detectSplitExpression } from '../../utils/mathExpression';
import './AmountInput.css';

// Campo de monto que acepta una expresión matemática simple (ej.
// "150+30-5") y la resuelve sola al perder el foco, mostrando el
// resultado antes de guardar — nunca usa eval()/new Function(), ver
// utils/mathExpression.js. `value`/`onChange` son el texto crudo tal
// como lo escribe el usuario (para poder seguir escribiendo "150+"
// sin que el campo lo rechace); el número final resuelto es lo que
// queda en `value` después del blur.
//
// La innovación pedida explícitamente — dividir un gasto entre varias
// personas o centros de costo — es opcional: solo se activa si la
// pantalla pasa `onApplySplit`. Si el usuario escribe "300/3", se
// muestra una sugerencia para repartirlo; si no se confirma, "300/3"
// se resuelve igual que cualquier otra expresión (100).
export default function AmountInput({ value, onChange, onApplySplit, splitLabel, ...inputProps }) {
  const splitInfo = useMemo(() => (onApplySplit ? detectSplitExpression(value) : null), [value, onApplySplit]);

  function handleBlur(event) {
    const resolved = evaluateMathExpression(value);
    if (resolved !== null && isExpression(value)) {
      onChange(resolved.toFixed(2));
    }
    inputProps.onBlur?.(event);
  }

  return (
    <span className="amount-input">
      <input
        {...inputProps}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
      />
      {splitInfo && (
        <span className="amount-input-split-hint">
          ¿Dividir {splitInfo.amount} en {splitInfo.parts} {splitLabel || 'partes'} de {splitInfo.perPart.toFixed(2)} cada uno?
          <button
            type="button"
            className="btn btn-small"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onApplySplit(splitInfo)}
          >
            Aplicar reparto
          </button>
        </span>
      )}
    </span>
  );
}
