import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { savedViewsApi } from '../api/saved-views';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { evaluateCondition } from '../utils/conditionEvaluator';
import HelpTooltip from './HelpTooltip';
import PinButton from '../core/ui/PinButton';
import './FilterBuilder.css';

const OPERATORS_BY_TYPE = {
  text: [
    { value: 'contains', label: 'contiene' },
    { value: 'eq', label: 'es igual a' },
    { value: 'neq', label: 'es distinto de' },
  ],
  number: [
    { value: 'eq', label: 'es igual a' },
    { value: 'neq', label: 'es distinto de' },
    { value: 'gt', label: 'mayor que' },
    { value: 'gte', label: 'mayor o igual que (mínimo)' },
    { value: 'lt', label: 'menor que' },
    { value: 'lte', label: 'menor o igual que (máximo)' },
  ],
  date: [
    { value: 'gte', label: 'desde' },
    { value: 'lte', label: 'hasta' },
    { value: 'gt', label: 'después de' },
    { value: 'lt', label: 'antes de' },
    { value: 'eq', label: 'es exactamente' },
  ],
  select: [
    { value: 'eq', label: 'es' },
    { value: 'neq', label: 'no es' },
  ],
};

let nextId = 0;
function newConditionId() {
  nextId += 1;
  return `cond-${Date.now()}-${nextId}`;
}

function fieldsByKey(fields) {
  return Object.fromEntries(fields.map((f) => [f.key, f]));
}

function defaultConditionFor(field) {
  const ops = OPERATORS_BY_TYPE[field.type] || OPERATORS_BY_TYPE.text;
  return { id: newConditionId(), field: field.key, op: ops[0].value, value: '' };
}

function treeFromConditions(logic, conditions) {
  return { [logic]: conditions.map(({ field, op, value }) => ({ field, op, value })) };
}

function conditionsFromTree(tree) {
  if (tree && Array.isArray(tree.all)) return { logic: 'all', conditions: tree.all.map((c) => ({ ...c, id: newConditionId() })) };
  if (tree && Array.isArray(tree.any)) return { logic: 'any', conditions: tree.any.map((c) => ({ ...c, id: newConditionId() })) };
  return { logic: 'all', conditions: [] };
}

// Constructor de filtros acumulativos, reutilizable sobre cualquier
// tabla: `fields` describe qué se puede filtrar (propio de cada
// pantalla), `data` es la lista ya cargada (el filtro corre en el
// navegador, nunca pide de nuevo al backend), y `onFilteredChange`
// recibe el resultado cada vez que cambia algo. Las vistas guardadas
// son compartibles con el equipo con un enlace `?vista=<id>` — no hay
// destinatario que elegir, cualquiera con acceso a esta pantalla puede
// abrirlo. `initialConditions` (opcional, `{logic, conditions}`) siembra
// un filtro transitorio al entrar desde otra pantalla (ej. un clic en
// un gráfico del Panel principal) — nunca se guarda como vista, es solo
// el punto de partida; un enlace compartido (`?vista=`) tiene prioridad
// si ambos llegan a coincidir.
export default function FilterBuilder({ tableKey, fields, data, onFilteredChange, initialConditions }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fieldMap = fieldsByKey(fields);

  const [logic, setLogic] = useState('all');
  const [conditions, setConditions] = useState([]);
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null);
  const appliedInitialRef = useRef(false);

  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [copiedId, setCopiedId] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    savedViewsApi.list(tableKey).then(setSavedViews).catch(() => setSavedViews([]));
  }, [tableKey]);

  // Abrir un enlace compartido (?vista=<id>): se conserva en la URL
  // (a diferencia de otras señales de navegación de esta app) para que
  // recargar la página o volver a abrir el enlace más tarde muestre el
  // mismo filtro otra vez.
  useEffect(() => {
    const viewId = searchParams.get('vista');
    if (!viewId) return;
    savedViewsApi
      .get(viewId)
      .then((view) => {
        const { logic: nextLogic, conditions: nextConditions } = conditionsFromTree(view.conditionTree);
        setLogic(nextLogic);
        setConditions(nextConditions);
        setActiveViewId(view.id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('vista')]);

  useEffect(() => {
    if (appliedInitialRef.current) return;
    if (searchParams.get('vista')) return; // un enlace compartido tiene prioridad
    if (!initialConditions || !initialConditions.conditions || initialConditions.conditions.length === 0) return;
    appliedInitialRef.current = true;
    setLogic(initialConditions.logic || 'all');
    setConditions(initialConditions.conditions.map((c) => ({ ...c, id: newConditionId() })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConditions]);

  useEffect(() => {
    if (conditions.length === 0) {
      onFilteredChange(data);
      return;
    }
    const tree = treeFromConditions(logic, conditions);
    onFilteredChange(data.filter((row) => evaluateCondition(tree, row)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, logic, conditions]);

  function addCondition() {
    setConditions((prev) => [...prev, defaultConditionFor(fields[0])]);
    setActiveViewId(null);
  }

  function updateCondition(id, patch) {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.field) {
          const ops = OPERATORS_BY_TYPE[fieldMap[patch.field]?.type] || OPERATORS_BY_TYPE.text;
          next.op = ops[0].value;
          next.value = '';
        }
        return next;
      })
    );
    setActiveViewId(null);
  }

  function removeCondition(id) {
    setConditions((prev) => prev.filter((c) => c.id !== id));
    setActiveViewId(null);
  }

  function clearFilters() {
    setConditions([]);
    setLogic('all');
    setActiveViewId(null);
  }

  async function handleSave() {
    if (conditions.length === 0) {
      setSaveError('Agrega al menos una condición antes de guardar.');
      return;
    }
    if (!viewName.trim()) {
      setSaveError('Ponle un nombre a la vista.');
      return;
    }
    setIsSaving(true);
    setSaveError('');
    try {
      const created = await savedViewsApi.create({
        tableKey,
        name: viewName.trim(),
        conditionTree: treeFromConditions(logic, conditions),
      });
      setSavedViews((prev) => [created, ...prev]);
      setActiveViewId(created.id);
      setViewName('');
      setIsSaveOpen(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'No se pudo guardar la vista.');
    } finally {
      setIsSaving(false);
    }
  }

  function applyView(view) {
    const { logic: nextLogic, conditions: nextConditions } = conditionsFromTree(view.conditionTree);
    setLogic(nextLogic);
    setConditions(nextConditions);
    setActiveViewId(view.id);
  }

  async function shareView(view) {
    const url = `${window.location.origin}${location.pathname}?vista=${view.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(view.id);
      setTimeout(() => setCopiedId((prev) => (prev === view.id ? null : prev)), 2500);
    } catch {
      window.prompt('Copia este enlace para compartir la vista:', url);
    }
  }

  async function deleteView(view) {
    setDeleteError('');
    const ok = await confirm({
      title: 'Eliminar vista guardada',
      message: `¿Eliminar la vista "${view.name}"? Cualquiera que la tuviera guardada dejará de poder abrirla.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await savedViewsApi.remove(view.id);
      setSavedViews((prev) => prev.filter((v) => v.id !== view.id));
      if (activeViewId === view.id) setActiveViewId(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'No se pudo eliminar la vista.');
    }
  }

  return (
    <div className="filter-builder">
      <div className="filter-builder-top">
        <div className="filter-builder-logic">
          <span className="filter-builder-logic-label">
            Combinar con
            <HelpTooltip text="Y: deben cumplirse todas las condiciones a la vez. O: alcanza con que se cumpla una sola." />
          </span>
          <div className="filter-builder-logic-toggle">
            <button
              type="button"
              className={logic === 'all' ? 'is-active' : ''}
              onClick={() => {
                setLogic('all');
                setActiveViewId(null);
              }}
            >
              Y (todas)
            </button>
            <button
              type="button"
              className={logic === 'any' ? 'is-active' : ''}
              onClick={() => {
                setLogic('any');
                setActiveViewId(null);
              }}
            >
              O (alguna)
            </button>
          </div>
        </div>
        {activeViewId && (
          <span className="filter-builder-active-view">
            Viendo: {savedViews.find((v) => v.id === activeViewId)?.name || 'vista compartida'}
          </span>
        )}
      </div>

      {conditions.length === 0 && <p className="text-muted filter-builder-empty">Sin filtros — se muestran todos los registros.</p>}

      {conditions.map((cond) => {
        const field = fieldMap[cond.field] || fields[0];
        const ops = OPERATORS_BY_TYPE[field.type] || OPERATORS_BY_TYPE.text;
        return (
          <div className="filter-builder-row" key={cond.id}>
            <select value={cond.field} onChange={(e) => updateCondition(cond.id, { field: e.target.value })}>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select value={cond.op} onChange={(e) => updateCondition(cond.id, { op: e.target.value })}>
              {ops.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {field.type === 'select' ? (
              <select value={cond.value} onChange={(e) => updateCondition(cond.id, { value: e.target.value })}>
                <option value="">Selecciona…</option>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                value={cond.value}
                onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                placeholder={field.type === 'text' ? 'Texto a buscar' : undefined}
              />
            )}
            <button type="button" className="filter-builder-remove" onClick={() => removeCondition(cond.id)} aria-label="Quitar condición">
              ×
            </button>
          </div>
        );
      })}

      <div className="filter-builder-actions">
        <button type="button" className="btn btn-small" onClick={addCondition}>
          + Agregar condición
        </button>
        {conditions.length > 0 && (
          <button type="button" className="btn btn-small" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
        <button type="button" className="btn btn-small" onClick={() => setIsSaveOpen((v) => !v)}>
          {isSaveOpen ? 'Cancelar' : 'Guardar como…'}
        </button>
      </div>

      {isSaveOpen && (
        <div className="filter-builder-save-form">
          <input
            type="text"
            placeholder="Nombre de la vista (ej. Facturas vencidas de julio)"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
          />
          <button type="button" className="btn btn-primary btn-small" disabled={isSaving} onClick={handleSave}>
            {isSaving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}
      {saveError && <p className="alert-box alert-box-error filter-builder-message">{saveError}</p>}

      {savedViews.length > 0 && (
        <div className="filter-builder-saved-views">
          <p className="filter-builder-saved-views-title">Vistas guardadas</p>
          {deleteError && <p className="alert-box alert-box-error filter-builder-message">{deleteError}</p>}
          <ul>
            {savedViews.map((view) => (
              <li key={view.id} className={view.id === activeViewId ? 'is-active' : ''}>
                <button type="button" className="filter-builder-saved-view-name" onClick={() => applyView(view)}>
                  {view.name}
                </button>
                <span className="filter-builder-saved-view-meta">por {view.createdByUser?.name || '—'}</span>
                <PinButton path={`${location.pathname}?vista=${view.id}`} label={view.name} />
                <button type="button" className="btn btn-small" onClick={() => shareView(view)}>
                  {copiedId === view.id ? '¡Enlace copiado!' : 'Compartir'}
                </button>
                {(view.createdByUserId === user?.id || user?.role === 'ADMIN') && (
                  <button type="button" className="btn btn-small" onClick={() => deleteView(view)}>
                    Eliminar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
