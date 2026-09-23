import { useCallback, useEffect, useMemo, useState } from 'react';
import { fpaDimensionsApi } from '../../api/fpa';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const DIMENSION_TYPES = [
  { value: 'DEPARTMENT', label: 'Departamento', icon: '◆' },
  { value: 'BUSINESS_LINE', label: 'Línea de Negocio', icon: '◇' },
  { value: 'COST_CENTER', label: 'Centro de Costo', icon: '▲' },
  { value: 'PRODUCT', label: 'Producto', icon: '●' },
  { value: 'CLIENT', label: 'Cliente', icon: '○' },
  { value: 'OTHER', label: 'Otra', icon: '□' },
];

const EMPTY_FORM = { type: 'DEPARTMENT', name: '', parentId: '' };

function flattenTree(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ ...node, depth });
    if (node.children?.length) flattenTree(node.children, depth + 1, out);
  }
  return out;
}

function DimensionRow({ dimension, depth, collapsedIds, onToggle, canManage, onToggleActive, onDelete, rowErrors }) {
  const hasChildren = dimension.children?.length > 0;
  const isCollapsed = collapsedIds.has(dimension.id);
  const rowError = rowErrors[dimension.id];

  return (
    <>
      <div className={`account-tree-row${dimension.isActive ? '' : ' is-inactive'}`}>
        {Array.from({ length: depth }).map((_, i) => (
          <span key={i} className="account-tree-guide" />
        ))}
        {hasChildren ? (
          <button
            type="button"
            className="account-tree-toggle"
            onClick={() => onToggle(dimension.id)}
            aria-label={isCollapsed ? 'Expandir' : 'Contraer'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="account-tree-toggle is-spacer">▸</span>
        )}
        <span className="account-tree-name">{dimension.name}</span>
        <div className="account-tree-meta">
          <StatusSeal
            status={dimension.isActive ? 'active' : 'inactive'}
            label={dimension.isActive ? 'Activa' : 'Inactiva'}
          />
          {canManage && (
            <div className="btn-row">
              <button type="button" className="btn btn-small" onClick={() => onToggleActive(dimension)}>
                {dimension.isActive ? 'Desactivar' : 'Activar'}
              </button>
              <button type="button" className="btn btn-small btn-danger" onClick={() => onDelete(dimension)}>
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
      {rowError && (
        <p className="alert-box alert-box-error" style={{ margin: '6px 0' }}>
          {rowError}
        </p>
      )}
      {hasChildren && !isCollapsed && (
        <div>
          {dimension.children.map((child) => (
            <DimensionRow
              key={child.id}
              dimension={child}
              depth={depth + 1}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              canManage={canManage}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              rowErrors={rowErrors}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function DimensionsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [tree, setTree] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [rowErrors, setRowErrors] = useState({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await fpaDimensionsApi.tree();
      setTree(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las dimensiones.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const flatDimensions = useMemo(() => flattenTree(tree), [tree]);
  const sectionsByType = useMemo(() => {
    const groups = new Map();
    for (const node of tree) {
      if (!groups.has(node.type)) groups.set(node.type, []);
      groups.get(node.type).push(node);
    }
    return groups;
  }, [tree]);

  function toggleCollapsed(id) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await fpaDimensionsApi.create({ ...form, parentId: form.parentId || undefined });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadTree();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la dimensión.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(dimension) {
    setRowErrors((prev) => ({ ...prev, [dimension.id]: '' }));
    try {
      await fpaDimensionsApi.update(dimension.id, { isActive: !dimension.isActive });
      await loadTree();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [dimension.id]: err instanceof ApiError ? err.message : 'No se pudo actualizar la dimensión.',
      }));
    }
  }

  async function handleDelete(dimension) {
    const ok = await confirm({
      title: 'Eliminar dimensión',
      message: `Vas a eliminar "${dimension.name}". Esto no se puede deshacer. Si tiene dimensiones hijas o está etiquetada en algún asiento o línea de presupuesto, no se podrá eliminar.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    setRowErrors((prev) => ({ ...prev, [dimension.id]: '' }));
    try {
      await fpaDimensionsApi.remove(dimension.id);
      await loadTree();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [dimension.id]: err instanceof ApiError ? err.message : 'No se pudo eliminar la dimensión.',
      }));
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Dimensiones Analíticas
            <HelpTooltip text="Son las etiquetas con las que puedes agrupar y analizar la información financiera más allá de las cuentas contables: por departamento, línea de negocio, centro de costo, producto o cliente. Puedes anidarlas (ej. “Ventas Norte” dentro de “Ventas”)." />
          </h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nueva dimensión'}
            </button>
          )}
        </div>

        {canManage && isFormOpen && (
          <form
            onSubmit={handleCreate}
            style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ventas Norte"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">
                  Tipo
                  <HelpTooltip text="Qué clase de dimensión es: Departamento (ej. Ventas, Operaciones), Línea de Negocio, Centro de Costo, Producto, Cliente, u Otra." />
                </span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {DIMENSION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Dimensión padre (opcional)
                  <HelpTooltip text="Si esta dimensión es una subdivisión de otra más general, selecciónala aquí para que aparezca anidada en el árbol." />
                </span>
                <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">Sin dimensión padre</option>
                  {flatDimensions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {'—'.repeat(d.depth)} {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {formError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear dimensión'}
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && flatDimensions.length === 0 && (
          <EmptyState
            icon="◆"
            message="Todavía no creaste ninguna dimensión analítica — crea la primera con “+ Nueva dimensión”, arriba."
          />
        )}

        {!isLoading &&
          !loadError &&
          DIMENSION_TYPES.map((typeMeta) => {
            const roots = sectionsByType.get(typeMeta.value);
            if (!roots || roots.length === 0) return null;
            return (
              <div key={typeMeta.value}>
                <p className="section-title">
                  <span className="section-title-icon">{typeMeta.icon}</span>
                  {typeMeta.label}
                </p>
                {roots.map((root) => (
                  <DimensionRow
                    key={root.id}
                    dimension={root}
                    depth={0}
                    collapsedIds={collapsedIds}
                    onToggle={toggleCollapsed}
                    canManage={canManage}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    rowErrors={rowErrors}
                  />
                ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}
