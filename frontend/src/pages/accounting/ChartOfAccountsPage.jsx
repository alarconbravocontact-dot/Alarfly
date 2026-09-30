import { useCallback, useEffect, useMemo, useState } from 'react';
import { accountsApi, accountTemplatesApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Activo', icon: '◆' },
  { value: 'LIABILITY', label: 'Pasivo', icon: '◇' },
  { value: 'EQUITY', label: 'Patrimonio', icon: '▲' },
  { value: 'INCOME', label: 'Ingreso', icon: '●' },
  { value: 'EXPENSE', label: 'Gasto', icon: '○' },
];

const EMPTY_FORM = {
  code: '',
  name: '',
  type: 'ASSET',
  normalBalance: 'DEBIT',
  parentId: '',
  isPostable: true,
  description: '',
};

function flattenTree(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ ...node, depth });
    if (node.children?.length) flattenTree(node.children, depth + 1, out);
  }
  return out;
}

// Ruta real desde la raíz del árbol hasta una cuenta (para la miga de
// pan jerárquica cuando el usuario "enfoca" una rama) — no viene del
// backend porque el árbol solo trae `children`, nunca un `parentId`
// resuelto hacia arriba.
function findAccountPath(nodes, id, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node];
    if (node.id === id) return nextPath;
    if (node.children?.length) {
      const found = findAccountPath(node.children, id, nextPath);
      if (found) return found;
    }
  }
  return null;
}

function AccountRow({ account, depth, collapsedIds, onToggle, canManage, onToggleActive, onDelete, rowErrors, onFocus }) {
  const hasChildren = account.children?.length > 0;
  const isCollapsed = collapsedIds.has(account.id);
  const rowError = rowErrors[account.id];

  return (
    <>
      <div className={`account-tree-row${account.isActive ? '' : ' is-inactive'}`}>
        {Array.from({ length: depth }).map((_, i) => (
          <span key={i} className="account-tree-guide" />
        ))}
        {hasChildren ? (
          <button
            type="button"
            className="account-tree-toggle"
            onClick={() => onToggle(account.id)}
            aria-label={isCollapsed ? 'Expandir' : 'Contraer'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="account-tree-toggle is-spacer">▸</span>
        )}
        <span className="account-tree-code">{account.code}</span>
        <span className="account-tree-name">{account.name}</span>
        <div className="account-tree-meta">
          <span className="account-tree-meta-item">{account.normalBalance === 'DEBIT' ? 'Débito' : 'Crédito'}</span>
          <StatusSeal status={account.isActive ? 'active' : 'inactive'} label={account.isActive ? 'Activa' : 'Inactiva'} />
          {hasChildren && (
            <button type="button" className="btn btn-small" onClick={() => onFocus(account)}>
              Ver solo esta cuenta
            </button>
          )}
          {canManage && (
            <div className="btn-row">
              <button type="button" className="btn btn-small" onClick={() => onToggleActive(account)}>
                {account.isActive ? 'Desactivar' : 'Activar'}
              </button>
              <button type="button" className="btn btn-small btn-danger" onClick={() => onDelete(account)}>
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
          {account.children.map((child) => (
            <AccountRow
              key={child.id}
              account={child}
              depth={depth + 1}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              canManage={canManage}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              rowErrors={rowErrors}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function ChartOfAccountsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  const [tree, setTree] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [rowErrors, setRowErrors] = useState({});
  const [focusedId, setFocusedId] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // F17-E2: bug real de severidad alta encontrado con una empresa
  // nueva de verdad — el servicio de plantillas ya existía completo
  // (es lo que usa `prisma/seed.js`), pero nunca tuvo ninguna
  // pantalla. Sin esto, una empresa nueva no tenía NINGUNA forma de
  // conseguir un plan de cuentas salvo crear cada cuenta a mano, una
  // por una — y sin plan de cuentas no se puede crear ni una cuenta
  // bancaria, ni una venta, ni nada que dependa de una cuenta
  // contable real.
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await accountsApi.tree();
      setTree(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el plan de cuentas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (!canManage) return;
    accountTemplatesApi
      .list()
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) setSelectedTemplateId(data[0].id);
      })
      .catch(() => {});
  }, [canManage]);

  async function handleApplyTemplate() {
    if (!selectedTemplateId) return;
    const template = templates.find((t) => t.id === selectedTemplateId);
    const ok = await confirm({
      title: 'Aplicar plantilla de cuentas',
      message: `Se van a crear todas las cuentas de "${template?.name || 'esta plantilla'}" en tu plan de cuentas. Las cuentas que ya tengas no se tocan ni se duplican.`,
      confirmLabel: 'Aplicar plantilla',
    });
    if (!ok) return;

    setTemplateError('');
    setIsApplyingTemplate(true);
    try {
      await accountTemplatesApi.apply(selectedTemplateId);
      await loadTree();
    } catch (err) {
      setTemplateError(err instanceof ApiError ? err.message : 'No se pudo aplicar la plantilla.');
    } finally {
      setIsApplyingTemplate(false);
    }
  }

  const flatAccounts = useMemo(() => flattenTree(tree), [tree]);
  const sectionsByType = useMemo(() => {
    const groups = new Map();
    for (const node of tree) {
      if (!groups.has(node.type)) groups.set(node.type, []);
      groups.get(node.type).push(node);
    }
    return groups;
  }, [tree]);

  // Ruta jerárquica real cuando el usuario "enfoca" una rama del árbol
  // ("Ver solo esta cuenta") — cada nivel es clicable para volver a un
  // ancestro sin perder de vista cómo se llegó ahí, distinto de la
  // miga de pan genérica de navegación entre pantallas.
  const focusedPath = focusedId ? findAccountPath(tree, focusedId) : null;
  const focusedNode = focusedPath ? focusedPath[focusedPath.length - 1] : null;

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
      await accountsApi.create({ ...form, parentId: form.parentId || null });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadTree();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(account) {
    setRowErrors((prev) => ({ ...prev, [account.id]: '' }));
    try {
      await accountsApi.update(account.id, { isActive: !account.isActive });
      await loadTree();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [account.id]: err instanceof ApiError ? err.message : 'No se pudo actualizar la cuenta.',
      }));
    }
  }

  async function handleDelete(account) {
    const ok = await confirm({
      title: 'Eliminar cuenta',
      message: `Vas a eliminar "${account.code} · ${account.name}". Esto no se puede deshacer. Si la cuenta tiene movimientos o cuentas hijas, no se podrá eliminar.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    setRowErrors((prev) => ({ ...prev, [account.id]: '' }));
    try {
      await accountsApi.remove(account.id);
      await loadTree();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [account.id]: err instanceof ApiError ? err.message : 'No se pudo eliminar la cuenta.',
      }));
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Árbol de cuentas</h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nueva cuenta'}
            </button>
          )}
        </div>

        {canManage && isFormOpen && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>Código</span>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="1105"
                  required
                />
              </label>
              <label className="field">
                <span>Nombre</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bancos"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">
                  Tipo
                  <HelpTooltip text="Qué representa esta cuenta en el negocio: Activo es lo que la empresa tiene (ej. bancos), Pasivo lo que debe, Patrimonio lo que aportaron los dueños, Ingreso lo que entra por ventas, Gasto lo que se paga para operar." />
                </span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Saldo normal
                  <HelpTooltip text="De qué lado crece normalmente esta cuenta. Débito: cuentas de lo que tienes o gastas (ej. Bancos, Gastos). Crédito: cuentas de lo que debes o ganas (ej. Proveedores, Ventas). Si no estás seguro, Activos y Gastos van en Débito; Pasivos, Patrimonio e Ingresos van en Crédito." />
                </span>
                <select value={form.normalBalance} onChange={(e) => setForm({ ...form, normalBalance: e.target.value })}>
                  <option value="DEBIT">Débito</option>
                  <option value="CREDIT">Crédito</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Cuenta padre (opcional)
                  <HelpTooltip text="Si esta cuenta es una subdivisión de otra más general (ej. “Bancos” dentro de “Activo Corriente”), selecciónala aquí para que aparezca anidada en el árbol." />
                </span>
                <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">Sin cuenta padre</option>
                  {flatAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {'—'.repeat(a.depth)} {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Descripción (opcional)</span>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="field field-checkbox">
                <input
                  type="checkbox"
                  checked={form.isPostable}
                  onChange={(e) => setForm({ ...form, isPostable: e.target.checked })}
                />
                <span className="field-label">
                  Recibe movimientos directamente
                  <HelpTooltip text="Actívalo si en esta cuenta se van a registrar movimientos de dinero. Desactívalo si es solo una cuenta “sombrilla” que agrupa a otras (ej. “Activo Corriente” agrupa a “Caja” y “Bancos”, pero no recibe movimientos ella misma)." />
                </span>
              </label>
            </div>
            {formError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{formError}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear cuenta'}
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && flatAccounts.length === 0 && (
          <>
            <EmptyState
              icon="◆"
              message="Todavía no registraste ninguna cuenta — crea la primera con “+ Nueva cuenta”, arriba."
            />
            {canManage && templates.length > 0 && (
              <div className="panel" style={{ marginTop: 16 }}>
                <p className="field-label">
                  O empieza más rápido con una plantilla
                  <HelpTooltip text="Una plantilla crea de una vez un plan de cuentas completo y ya organizado (activos, pasivos, patrimonio, ingresos y gastos), para que no tengas que crear cada cuenta a mano. Se puede editar después." />
                </p>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary" onClick={handleApplyTemplate} disabled={isApplyingTemplate}>
                    {isApplyingTemplate ? 'Aplicando…' : 'Aplicar plantilla'}
                  </button>
                </div>
                {templateError && (
                  <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                    {templateError}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {!isLoading && !loadError && flatAccounts.length > 0 && focusedNode && (
          <nav className="ui-breadcrumb" aria-label="Ruta en el árbol de cuentas" style={{ marginBottom: 16 }}>
            <span className="ui-breadcrumb-item">
              <button type="button" className="ui-breadcrumb-link btn-as-link" onClick={() => setFocusedId(null)}>
                Árbol de cuentas
              </button>
              <span className="ui-breadcrumb-sep" aria-hidden="true">›</span>
            </span>
            {focusedPath.map((node, i) => (
              <span key={node.id} className="ui-breadcrumb-item">
                {i < focusedPath.length - 1 ? (
                  <button type="button" className="ui-breadcrumb-link btn-as-link" onClick={() => setFocusedId(node.id)}>
                    {node.code} · {node.name}
                  </button>
                ) : (
                  <span className="ui-breadcrumb-current">{node.code} · {node.name}</span>
                )}
                {i < focusedPath.length - 1 && (
                  <span className="ui-breadcrumb-sep" aria-hidden="true">›</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {!isLoading && !loadError && flatAccounts.length > 0 && focusedNode && (
          <AccountRow
            account={focusedNode}
            depth={0}
            collapsedIds={collapsedIds}
            onToggle={toggleCollapsed}
            canManage={canManage}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
            rowErrors={rowErrors}
            onFocus={(acc) => setFocusedId(acc.id)}
          />
        )}

        {!isLoading &&
          !loadError &&
          !focusedNode &&
          ACCOUNT_TYPES.map((typeMeta) => {
            const roots = sectionsByType.get(typeMeta.value);
            if (!roots || roots.length === 0) return null;
            return (
              <div key={typeMeta.value}>
                <p className="section-title">
                  <span className="section-title-icon">{typeMeta.icon}</span>
                  {typeMeta.label}
                </p>
                {roots.map((root) => (
                  <AccountRow
                    key={root.id}
                    account={root}
                    depth={0}
                    collapsedIds={collapsedIds}
                    onToggle={toggleCollapsed}
                    canManage={canManage}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    rowErrors={rowErrors}
                    onFocus={(acc) => setFocusedId(acc.id)}
                  />
                ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}
