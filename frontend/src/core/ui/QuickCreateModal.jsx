import { useState } from 'react';
import { ApiError } from '../../api/client';
import './QuickCreateModal.css';

/**
 * Modal rápido genérico para crear una entidad nueva sin salir del
 * formulario actual (usado por EntityAutocomplete cuando la búsqueda no
 * encuentra ninguna coincidencia). `fields` describe el formulario
 * (propio de cada tipo de entidad); este componente no sabe nada de
 * cuentas, clientes ni productos — solo arma el formulario y llama a
 * `onSubmit`.
 *
 * `fields`: [{ key, label, type: 'text'|'number'|'select', required?,
 * options?: [{value,label}], helpText? }]
 */
export default function QuickCreateModal({ title, fields, initialValues, onSubmit, onSuccess, onCancel }) {
  const [values, setValues] = useState(() => {
    const base = {};
    for (const f of fields) base[f.key] = initialValues?.[f.key] ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '');
    return base;
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function update(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    for (const f of fields) {
      if (f.required && !String(values[f.key] ?? '').trim()) {
        setError(`El campo "${f.label}" es obligatorio.`);
        return;
      }
    }
    setIsSaving(true);
    try {
      const payload = {};
      for (const f of fields) {
        const raw = values[f.key];
        if (raw === '' || raw === undefined) continue;
        payload[f.key] = f.type === 'number' ? Number(raw) : raw;
      }
      const created = await onSubmit(payload);
      onSuccess(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="qc-modal-overlay" role="presentation" onClick={onCancel}>
      <div className="qc-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="qc-modal-title" onClick={(e) => e.stopPropagation()}>
        <p id="qc-modal-title" className="qc-modal-title">
          {title}
        </p>
        <form onSubmit={handleSubmit} className="qc-modal-form">
          {fields.map((f) => (
            <label key={f.key} className="field">
              <span>
                {f.label}
                {f.required ? ' *' : ''}
              </span>
              {f.type === 'select' ? (
                <select value={values[f.key]} onChange={(e) => update(f.key, e.target.value)} autoFocus={f.autoFocus}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={values[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  autoFocus={f.autoFocus}
                />
              )}
            </label>
          ))}
          {error && <p className="alert-box alert-box-error">{error}</p>}
          <div className="qc-modal-actions">
            <button type="button" className="btn" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
