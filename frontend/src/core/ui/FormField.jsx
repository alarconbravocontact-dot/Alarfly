import { cloneElement, isValidElement } from 'react';
import HelpTooltip from '../../components/HelpTooltip';
import './FormField.css';

// Componente de formulario compartido (Feature X): una sola fuente de
// verdad para "¿este campo es obligatorio ahora mismo?" — `required`
// se pasa una sola vez acá, y de ahí se derivan tanto el asterisco
// visual (siempre el mismo color contrastante en toda la app) como el
// atributo HTML `required` real del campo interno, inyectado
// automáticamente en vez de tener que repetirlo a mano en el
// `<input>`. Como `required` es una prop normal, si quien llama la
// calcula a partir de otro campo del formulario (ej.
// `required={form.type === 'LOAN'}`), el asterisco aparece y
// desaparece solo cuando React vuelve a renderizar — el caso
// "dinámico" no necesita ningún mecanismo especial aparte.
export default function FormField({ label, required = false, help, checkbox = false, children }) {
  const child = isValidElement(children)
    ? cloneElement(children, { required, 'aria-required': required || undefined })
    : children;

  const labelContent = (
    <span className="field-label">
      {label}
      {required && (
        <span className="required-asterisk" aria-hidden="true">
          {' '}
          *
        </span>
      )}
      {help && <HelpTooltip text={help} />}
    </span>
  );

  if (checkbox) {
    return (
      <label className="field field-checkbox">
        {child}
        {labelContent}
      </label>
    );
  }

  return (
    <label className="field">
      {labelContent}
      {child}
    </label>
  );
}

// Nota fija al pie de cualquier formulario que use FormField con al
// menos un campo obligatorio — mismo texto en toda la app, nunca
// redactado pantalla por pantalla.
export function RequiredFieldsNote() {
  return <p className="required-fields-note">* Campos obligatorios</p>;
}
