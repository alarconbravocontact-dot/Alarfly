import { useCallback, useEffect, useMemo, useState } from 'react';
import { accountsApi, accountTemplatesApi, accountingReportsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import DataTable from '../../core/ui/DataTable';
import RecordDrawer from '../../core/ui/RecordDrawer';
import { formatCurrency, formatDate } from '../../utils/format';

// Simplificación pedida explícitamente por el usuario (piloto de
// "menos jerarquía visual", 2026-10-06): las cuentas se siguen
// guardando exactamente igual por dentro (padre/hijo, el backend no
// cambió en nada), pero en pantalla ya no se ven como un árbol que se
// expande/contrae — son una lista plana, con buscador y filtro por
// tipo, igual que cualquier otra tabla de la app. Se quitaron: el
// árbol recursivo (`AccountRow`), expandir/contraer, la indentación
// por profundidad y "Ver solo esta cuenta" — toda esa complejidad
// visual desapareció, no solo se escondió.

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Activo' },
  { value: 'LIABILITY', label: 'Pasivo' },
  { value: 'EQUITY', label: 'Patrimonio' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Gasto' },
];

const TYPE_LABEL = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.value, t.label]));

const EMPTY_FORM = {
  code: '',
  name: '',
  type: 'ASSET',
  normalBalance: 'DEBIT',
  parentId: '',
  isPostable: true,
  description: '',
};

function flattenTree(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) flattenTree(node.children, out);
  }
  return out;
}

export default function ChartOfAccountsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  const [tree, setTree] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rowErrors, setRowErrors] = useState({});

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState('');

  // Detalle contextual (drawer): seleccionar una cuenta en la lista NO
  // navega a otra pantalla ni reinicia el buscador/filtro — ese estado
  // (search/typeFilter arriba) vive en este mismo componente, así que
  // abrir/cerrar el drawer nunca lo toca.
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');

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
  const accountById = useMemo(() => new Map(flatAccounts.map((a) => [a.id, a])), [flatAccounts]);

  const visibleAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flatAccounts.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false;
      if (q && !a.code.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [flatAccounts, search, typeFilter]);

  const selectedAccount = selectedAccountId ? accountById.get(selectedAccountId) : null;
  const selectedIndex = selectedAccountId
    ? visibleAccounts.findIndex((a) => a.id === selectedAccountId)
    : -1;

  useEffect(() => {
    if (!selectedAccountId) {
      setLedger(null);
      return;
    }
    let cancelled = false;
    setLedgerLoading(true);
    setLedgerError('');
    accountingReportsApi
      .generalLedger(selectedAccountId)
      .then((data) => {
        if (!cancelled) setLedger(data);
      })
      .catch((err) => {
        if (!cancelled) setLedgerError(err instanceof ApiError ? err.message : 'No se pudieron cargar los movimientos.');
      })
      .finally(() => {
        if (!cancelled) setLedgerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  function openAccountDetail(account) {
    setSelectedAccountId(account.id);
  }

  function closeAccountDetail() {
    setSelectedAccountId(null);
  }

  function navigateAccountDetail(delta) {
    if (selectedIndex === -1) return;
    const nextAccount = visibleAccounts[selectedIndex + delta];
    if (nextAccount) setSelectedAccountId(nextAccount.id);
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

  const columns = useMemo(
    () => [
      { key: 'code', label: 'Código', value: (a) => a.code, defaultWidth: 90 },
      { key: 'name', label: 'Nombre', value: (a) => a.name, defaultWidth: 200 },
      { key: 'type', label: 'Tipo', value: (a) => TYPE_LABEL[a.type] || a.type, defaultWidth: 110 },
      {
        key: 'normalBalance',
        label: 'Saldo normal',
        value: (a) => (a.normalBalance === 'DEBIT' ? 'Débito' : 'Crédito'),
        defaultWidth: 110,
      },
      {
        key: 'parent',
        label: 'Depende de',
        value: (a) => (a.parentId ? accountById.get(a.parentId)?.name || '' : ''),
        render: (a) => (a.parentId ? accountById.get(a.parentId)?.name || '—' : '—'),
        defaultWidth: 160,
      },
      {
        key: 'status',
        label: 'Estado',
        value: (a) => (a.isActive ? 'Activa' : 'Inactiva'),
        render: (a) => <StatusSeal status={a.isActive ? 'active' : 'inactive'} label={a.isActive ? 'Activa' : 'Inactiva'} />,
        defaultWidth: 120,
      },
      {
        key: 'actions',
        label: '',
        exportable: false,
        render: (a) => (
          <div>
            <div className="btn-row" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="btn btn-small" onClick={() => openAccountDetail(a)}>
                Ver detalle
              </button>
              {canManage && (
                <>
                  <button type="button" className="btn btn-small" onClick={() => handleToggleActive(a)}>
                    {a.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => handleDelete(a)}>
                    Eliminar
                  </button>
                </>
              )}
            </div>
            {rowErrors[a.id] && (
              <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                {rowErrors[a.id]}
              </p>
            )}
          </div>
        ),
        defaultWidth: 260,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountById, canManage, rowErrors]
  );

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Cuentas</h2>
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
                  <HelpTooltip text="Si esta cuenta es una subdivisión de otra más general (ej. “Bancos” dentro de “Activo Corriente”), selecciónala aquí." />
                </span>
                <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">Sin cuenta padre</option>
                  {flatAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
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

        {!isLoading && !loadError && flatAccounts.length === 0 && canManage && templates.length > 0 && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <p className="field-label">
              Empieza más rápido con una plantilla
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

        {!isLoading && !loadError && flatAccounts.length > 0 && (
          <div className="btn-row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Buscar por código o nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 240 }}
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}

        <DataTable
          tableKey="chart-of-accounts"
          columns={columns}
          data={visibleAccounts}
          rowKey={(a) => a.id}
          isLoading={isLoading}
          emptyIcon="◆"
          emptyMessage={
            flatAccounts.length === 0
              ? 'Todavía no registraste ninguna cuenta — crea la primera con “+ Nueva cuenta”, arriba.'
              : 'Ningún resultado con esta búsqueda/filtro.'
          }
          exportTitle="Plan de Cuentas"
        />
      </div>

      <RecordDrawer
        isOpen={Boolean(selectedAccount)}
        onClose={closeAccountDetail}
        title={selectedAccount ? `${selectedAccount.code} · ${selectedAccount.name}` : ''}
        subtitle={selectedAccount ? TYPE_LABEL[selectedAccount.type] : ''}
        onNavigate={navigateAccountDetail}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex !== -1 && selectedIndex < visibleAccounts.length - 1}
        footer={
          selectedAccount && canManage ? (
            <div style={{ width: '100%' }}>
              <div className="btn-row">
                <button type="button" className="btn btn-small" onClick={() => handleToggleActive(selectedAccount)}>
                  {selectedAccount.isActive ? 'Desactivar' : 'Activar'}
                </button>
                <button type="button" className="btn btn-small btn-danger" onClick={() => handleDelete(selectedAccount)}>
                  Eliminar
                </button>
              </div>
              {rowErrors[selectedAccount.id] && (
                <p className="alert-box alert-box-error" style={{ marginTop: 10 }}>
                  {rowErrors[selectedAccount.id]}
                </p>
              )}
            </div>
          ) : null
        }
        summary={
          selectedAccount && (
            <div>
              <div className="form-grid" style={{ marginBottom: 20 }}>
                <div className="field">
                  <span>Tipo</span>
                  <p>{TYPE_LABEL[selectedAccount.type]}</p>
                </div>
                <div className="field">
                  <span>Saldo normal</span>
                  <p>{selectedAccount.normalBalance === 'DEBIT' ? 'Débito' : 'Crédito'}</p>
                </div>
                <div className="field">
                  <span>Depende de</span>
                  <p>{selectedAccount.parentId ? accountById.get(selectedAccount.parentId)?.name || '—' : '—'}</p>
                </div>
                <div className="field">
                  <span>Estado</span>
                  <p>
                    <StatusSeal
                      status={selectedAccount.isActive ? 'active' : 'inactive'}
                      label={selectedAccount.isActive ? 'Activa' : 'Inactiva'}
                    />
                  </p>
                </div>
                <div className="field">
                  <span>Saldo actual</span>
                  <p>
                    <strong>{ledger ? formatCurrency(ledger.closingBalance) : '—'}</strong>
                  </p>
                </div>
              </div>

              <h3 style={{ marginBottom: 8 }}>Movimientos</h3>
              {ledgerLoading && <p>Cargando movimientos…</p>}
              {!ledgerLoading && ledgerError && <p className="alert-box alert-box-error">{ledgerError}</p>}
              {!ledgerLoading && !ledgerError && ledger && ledger.movements.length === 0 && (
                <p className="field-label">Esta cuenta todavía no tiene movimientos.</p>
              )}
              {!ledgerLoading && !ledgerError && ledger && ledger.movements.length > 0 && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th>Debe</th>
                      <th>Haber</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.movements.map((m, idx) => (
                      <tr key={`${m.entryId}-${idx}`}>
                        <td>{formatDate(new Date(m.date))}</td>
                        <td>{m.description}</td>
                        <td className="num">{formatCurrency(m.debit)}</td>
                        <td className="num">{formatCurrency(m.credit)}</td>
                        <td className="num">{formatCurrency(m.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        }
      />
    </div>
  );
}
