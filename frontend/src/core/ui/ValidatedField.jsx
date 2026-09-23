import { useState } from 'react';
import './ValidatedField.css';

// Campo con validación en tiempo real (Feature T), no solo al enviar
// el formulario — un solo componente compartido, reutilizable en
// cualquier campo con formato específico. `validate(value)` devuelve
// `{valid, message?, autoFix?}`; el mensaje siempre es específico y
// accionable (nunca "Campo inválido" genérico) y, cuando el error
// tiene una causa común conocida, `autoFix` trae el valor ya corregido
// — la innovación pedida explícitamente: un botón "Corregir
// automáticamente" que lo aplica en un clic.
export default function ValidatedField({ label, help, value, onChange, validate, required, type = 'text', ...inputProps }) {
  const [touched, setTouched] = useState(false);
  const result = validate(value);
  const showError = touched && !result.valid;

  return (
    <label className="field">
      <span className="field-label">
        {label}
        {help}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        required={required}
        aria-invalid={showError}
        className={showError ? 'validated-field-input-error' : undefined}
        {...inputProps}
      />
      {showError && (
        <span className="validated-field-message">
          {result.message}
          {result.autoFix !== undefined && (
            <button
              type="button"
              className="btn btn-small validated-field-autofix"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(result.autoFix);
                setTouched(false);
              }}
            >
              Corregir automáticamente
            </button>
          )}
        </span>
      )}
    </label>
  );
}
