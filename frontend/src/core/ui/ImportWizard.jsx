import { useMemo, useState } from 'react';
import { importApi } from '../../api/import';
import { importTemplatesApi } from '../../api/import-templates';
import { ApiError } from '../../api/client';
import './ImportWizard.css';

const NO_MAPPING = '';

function normalize(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase();
}

// Adivina un mapeo inicial razonable comparando el encabezado del
// archivo con la etiqueta o la clave de cada campo — es solo un punto
// de partida cómodo, el usuario siempre puede corregirlo antes de
// continuar.
function guessMapping(fields, headers) {
  const mapping = {};
  for (const field of fields) {
    const match = headers.find((h) => normalize(h) === normalize(field.label) || normalize(h) === normalize(field.key));
    mapping[field.key] = match || NO_MAPPING;
  }
  return mapping;
}

function convertValue(rawValue, type) {
  if (rawValue === undefined || rawValue === '') return undefined;
  if (type === 'number') {
    const n = Number(rawValue);
    return Number.isNaN(n) ? undefined : n;
  }
  return rawValue;
}

function mapRow(row, headers, fields, mapping) {
  const record = {};
  for (const field of fields) {
    const header = mapping[field.key];
    if (!header) continue;
    const colIndex = headers.indexOf(header);
    if (colIndex === -1) continue;
    const value = convertValue(row[colIndex], field.type);
    if (value !== undefined) record[field.key] = value;
  }
  return record;
}

// Asistente de importación genérico y reutilizable: arrastra o elige
// un archivo CSV/Excel, mapea sus columnas a los campos reales del
// sistema (con validación de tipo antes de avanzar), previsualiza las
// primeras 5 filas ya transformadas, y confirma la importación real —
// `onImport(rows)` es quien sabe cómo crear cada fila (este componente
// no conoce clientes, productos ni ningún otro dato de negocio).
//
// `fields`: [{key, label, type: 'text'|'number', required?}]
export default function ImportWizard({ targetKey, targetLabel, fields, onImport, onClose, onImported }) {
  const [step, setStep] = useState('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsed, setParsed] = useState(null); // {headers, rows}

  const [mapping, setMapping] = useState({});
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    setParseError('');
    setIsParsing(true);
    try {
      const result = await importApi.parseFile(file);
      setParsed(result);
      setMapping(guessMapping(fields, result.headers));
      importTemplatesApi
        .list(targetKey)
        .then(setTemplates)
        .catch(() => setTemplates([]));
      setStep('mapping');
    } catch (err) {
      setParseError(err instanceof ApiError ? err.message : 'No se pudo leer el archivo. Confirma que sea un CSV o Excel válido.');
    } finally {
      setIsParsing(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  function applyTemplate(templateId) {
    setSelectedTemplateId(templateId);
    if (!templateId || !parsed) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const next = { ...mapping };
    for (const field of fields) {
      const header = template.columnMapping[field.key];
      if (header && parsed.headers.includes(header)) next[field.key] = header;
    }
    setMapping(next);
  }

  // Validación de tipo (feature pedida explícitamente: rechazar una
  // columna de texto mapeada a un campo numérico) — se calcula en cada
  // render de la pantalla de mapeo, sobre TODAS las filas del archivo,
  // no solo la vista previa.
  const mappingErrors = useMemo(() => {
    if (!parsed) return {};
    const errors = {};
    for (const field of fields) {
      const header = mapping[field.key];
      if (!header) {
        if (field.required) errors[field.key] = `"${field.label}" es obligatorio — elige qué columna del archivo le corresponde.`;
        continue;
      }
      const colIndex = parsed.headers.indexOf(header);
      if (field.type === 'number') {
        const invalidCount = parsed.rows.filter((row) => {
          const raw = row[colIndex];
          return raw !== '' && Number.isNaN(Number(raw));
        }).length;
        if (invalidCount > 0) {
          errors[field.key] = `La columna "${header}" tiene ${invalidCount} valor(es) que no son números — no se puede mapear a "${field.label}".`;
        }
      }
    }
    return errors;
  }, [parsed, mapping, fields]);

  const canProceedToPreview = parsed && Object.keys(mappingErrors).length === 0;

  const mappedRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) => mapRow(row, parsed.headers, fields, mapping));
  }, [parsed, fields, mapping]);

  async function handleSaveTemplate() {
    setTemplateError('');
    if (!templateName.trim()) {
      setTemplateError('Ponle un nombre a la plantilla.');
      return;
    }
    setIsSavingTemplate(true);
    try {
      const created = await importTemplatesApi.create({ targetKey, name: templateName.trim(), columnMapping: mapping });
      setTemplates((prev) => [created, ...prev]);
      setSelectedTemplateId(created.id);
      setTemplateName('');
    } catch (err) {
      setTemplateError(err instanceof ApiError ? err.message : 'No se pudo guardar la plantilla.');
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleConfirmImport() {
    setImportError('');
    setIsImporting(true);
    try {
      const result = await onImport(mappedRows);
      setImportResult(result);
      setStep('result');
      onImported?.(result);
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'No se pudo completar la importación.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="import-wizard-overlay" role="presentation" onClick={onClose}>
      <div
        className="import-wizard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-wizard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="import-wizard-header">
          <p id="import-wizard-title" className="import-wizard-title">
            Importar {targetLabel}
          </p>
          <button type="button" className="btn btn-small" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {step === 'upload' && (
          <div
            className={`import-wizard-dropzone${isDragging ? ' is-dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <p>Arrastra un archivo CSV o Excel (.xlsx) aquí, o</p>
            <label className="btn btn-primary import-wizard-file-label">
              Elegir archivo
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            {isParsing && <p className="text-muted" style={{ marginTop: 12 }}>Leyendo archivo…</p>}
            {parseError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {parseError}
              </p>
            )}
          </div>
        )}

        {step === 'mapping' && parsed && (
          <div>
            {templates.length > 0 && (
              <label className="field" style={{ marginBottom: 16 }}>
                <span>Usar una plantilla guardada (opcional)</span>
                <select value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">— Mapear manualmente —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  <th>Campo del sistema</th>
                  <th>Columna del archivo</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.key}>
                    <td>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </td>
                    <td>
                      <select
                        value={mapping[field.key] || NO_MAPPING}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      >
                        <option value={NO_MAPPING}>— No importar —</option>
                        {parsed.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      {mappingErrors[field.key] && (
                        <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                          {mappingErrors[field.key]}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="import-wizard-template-save">
              <input
                type="text"
                placeholder="Nombre para guardar este mapeo como plantilla (opcional)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <button type="button" className="btn btn-small" onClick={handleSaveTemplate} disabled={isSavingTemplate}>
                {isSavingTemplate ? 'Guardando…' : 'Guardar como plantilla'}
              </button>
            </div>
            {templateError && <p className="alert-box alert-box-error">{templateError}</p>}

            <div className="import-wizard-actions">
              <button type="button" className="btn" onClick={() => setStep('upload')}>
                Volver
              </button>
              <button type="button" className="btn btn-primary" disabled={!canProceedToPreview} onClick={() => setStep('preview')}>
                Ver vista previa ({parsed.rows.length} fila{parsed.rows.length === 1 ? '' : 's'})
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Vista previa de las primeras {Math.min(5, mappedRows.length)} de {mappedRows.length} fila(s) transformadas:
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  {fields.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mappedRows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {fields.map((f) => (
                      <td key={f.key}>{row[f.key] !== undefined ? String(row[f.key]) : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {importError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {importError}
              </p>
            )}

            <div className="import-wizard-actions">
              <button type="button" className="btn" onClick={() => setStep('mapping')}>
                Volver a mapear
              </button>
              <button type="button" className="btn btn-primary" disabled={isImporting} onClick={handleConfirmImport}>
                {isImporting ? 'Importando…' : `Importar ${mappedRows.length} fila(s)`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && importResult && (
          <div>
            <p className="alert-box alert-box-success">
              Se crearon {importResult.created} de {mappedRows.length} fila(s).
            </p>
            {importResult.errors?.length > 0 && (
              <div>
                <p className="text-muted">Filas que no se pudieron importar:</p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((e) => (
                      <tr key={e.row}>
                        <td>{e.row}</td>
                        <td>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="import-wizard-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
