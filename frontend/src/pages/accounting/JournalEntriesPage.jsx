import { Fragment, useCallback, useEffect, useState } from 'react';
import { accountsApi, journalEntriesApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import EntityAutocomplete from '../../core/ui/EntityAutocomplete';
import QuickCreateModal from '../../core/ui/QuickCreateModal';
import { recentlyUsedApi } from '../../api/recently-used';
import GlossaryTerm from '../../core/ui/GlossaryTerm';

const STATUS_LABELS = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente de aprobación',
  APPROVED: 'Aprobado',
};

const STATUS_SEAL_TONE = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'positive',
};

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'ASSET', label: 'Activo' },
  { value: 'LIABILITY', label: 'Pasivo' },
  { value: 'EQUITY', label: 'Patrimonio' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Gasto' },
];

const NORMAL_BALANCE_OPTIONS = [
  { value: 'DEBIT', label: 'Débito' },
  { value: 'CREDIT', label: 'Crédito' },
];

const ACCOUNT_QUICK_CREATE_FIELDS = [
  { key: 'code', label: 'Código', type: 'text', required: true, autoFocus: true },
  { key: 'name', label: 'Nombre', type: 'text', required: true },
  { key: 'type', label: 'Tipo', type: 'select', required: true, options: ACCOUNT_TYPE_OPTIONS },
  { key: 'normalBalance', label: 'Saldo normal', type: 'select', required: true, options: NORMAL_BALANCE_OPTIONS },
];

function emptyLine() {
  return { accountId: '', debit: '', credit: '', description: '' };
}

function sumLines(lines, field) {
  return lines.reduce((sum, line) => sum + (Number(line[field]) || 0), 0);
}

export default function JournalEntriesPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canRecord = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';
  const canApprove = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [actionError, setActionError] = useState({});

  const [date, setDate] = useState(toIsoDate(new Date()));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [quickCreateAccount, setQuickCreateAccount] = useState(null);
  const [accountFlash, setAccountFlash] = useState(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [accountsData, entriesData] = await Promise.all([
        accountsApi.list({ isActive: true }),
        journalEntriesApi.list(),
      ]);
      setAccounts(accountsData.filter((a) => a.isPostable));
      setEntries(entriesData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los asientos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const totalDebit = sumLines(lines, 'debit');
  const totalCredit = sumLines(lines, 'credit');
  const isBalanced = lines.length >= 2 && totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

  function updateLine(index, changes) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...changes } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    if (!isBalanced) {
      setFormError('El asiento debe cuadrar: la suma de débitos debe ser igual a la suma de créditos.');
      return;
    }
    setIsSaving(true);
    try {
      await journalEntriesApi.create({
        date,
        description,
        lines: lines
          .filter((line) => line.accountId)
          .map((line) => ({
            accountId: line.accountId,
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
            description: line.description || undefined,
          })),
      });
      setDescription('');
      setLines([emptyLine(), emptyLine()]);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar el asiento.');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleExpand(entry) {
    if (expandedId === entry.id) {
      setExpandedId(null);
      setExpandedEntry(null);
      return;
    }
    setExpandedId(entry.id);
    try {
      const full = await journalEntriesApi.getOne(entry.id);
      setExpandedEntry(full);
    } catch {
      setExpandedEntry(null);
    }
  }

  async function runAction(entry, action) {
    if (action === 'reverse') {
      const ok = await confirm({
        title: 'Reversar asiento',
        message: `Vas a reversar el asiento N.º ${entry.entryNumber} ("${entry.description}"). Se creará un asiento espejo que anula su efecto; el original no se borra ni se modifica.`,
        confirmLabel: 'Reversar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    if (action === 'remove') {
      const ok = await confirm({
        title: 'Eliminar borrador',
        message: `Vas a eliminar el asiento N.º ${entry.entryNumber} ("${entry.description}"). Esto no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        tone: 'danger',
      });
      if (!ok) return;
    }

    setActionError((prev) => ({ ...prev, [entry.id]: '' }));
    try {
      if (action === 'submit') await journalEntriesApi.submit(entry.id);
      if (action === 'approve') await journalEntriesApi.approve(entry.id);
      if (action === 'reverse') await journalEntriesApi.reverse(entry.id, {});
      if (action === 'remove') await journalEntriesApi.remove(entry.id);
      await loadAll();
    } catch (err) {
      setActionError((prev) => ({
        ...prev,
        [entry.id]: err instanceof ApiError ? err.message : 'No se pudo completar la acción.',
      }));
    }
  }

  return (
    <div className="page">
      {canRecord && (
        <div className="panel">
          <div className="panel-header">
            <h2>
              Registrar <GlossaryTerm termKey="journal-entry">asiento</GlossaryTerm>
            </h2>
          </div>
          <form onSubmit={handleCreate}>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <label className="field">
                <span>Fecha</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span>Descripción</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} required />
              </label>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>
                    <span className="field-label">
                      Débito
                      <HelpTooltip text="Pon el monto aquí si esta línea es lo que aumenta (ej. entra dinero a una cuenta de banco, o aumenta un gasto)." />
                    </span>
                  </th>
                  <th>
                    <span className="field-label">
                      Crédito
                      <HelpTooltip text="Pon el monto aquí si esta línea es lo que disminuye o de dónde sale el dinero (ej. sale de una cuenta de banco, o aumenta una venta)." />
                    </span>
                  </th>
                  <th>Descripción de la línea</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td>
                      <EntityAutocomplete
                        entityType="account"
                        items={accounts}
                        getId={(a) => a.id}
                        getLabel={(a) => `${a.code} · ${a.name}`}
                        getSearchText={(a) => `${a.code} ${a.name}`}
                        value={line.accountId}
                        onChange={(id) => updateLine(index, { accountId: id })}
                        onCreateNew={(term) => setQuickCreateAccount({ lineIndex: index, term })}
                        createLabel="cuenta"
                        placeholder="Buscar cuenta…"
                        flashKey={accountFlash && accountFlash.lineIndex === index ? accountFlash.accountId : undefined}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit}
                        onChange={(e) => updateLine(index, { debit: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit}
                        onChange={(e) => updateLine(index, { credit: e.target.value })}
                      />
                    </td>
                    <td>
                      <input value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => removeLine(index)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="btn-row" style={{ marginTop: 12, alignItems: 'center' }}>
              <button type="button" className="btn btn-small" onClick={addLine}>
                + Agregar línea
              </button>
              <span className="text-muted field-label">
                Débitos: {formatCurrency(totalDebit)} · Créditos: {formatCurrency(totalCredit)}
                {isBalanced ? ' · Cuadra ✓' : ' · No cuadra todavía'}
                <HelpTooltip text="Un asiento contable siempre tiene que quedar en cero: la suma de lo que pusiste en Débito debe ser exactamente igual a la suma de lo que pusiste en Crédito. Es la forma en que el sistema se asegura de que ningún movimiento de dinero quede registrado a medias." />
              </span>
            </div>

            {formError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{formError}</p>}

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving || !isBalanced}>
                {isSaving ? 'Guardando…' : 'Registrar asiento'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Asientos registrados</h2>
        </div>

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && entries.length === 0 && (
          <EmptyState icon="●" message="Todavía no registraste ningún asiento contable." />
        )}

        {!isLoading && !loadError && entries.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>N.º</th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th className="num">Monto</th>
                <th>
                  <span className="field-label">
                    Estado
                    <HelpTooltip text="Borrador: todavía se puede editar o borrar. Pendiente de aprobación: ya se envió y espera que alguien más lo revise. Aprobado: ya quedó registrado en firme y afecta los reportes." />
                  </span>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const total = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
                return (
                  <Fragment key={entry.id}>
                    <tr>
                      <td>{entry.entryNumber}</td>
                      <td>{formatDate(new Date(entry.date))}</td>
                      <td>{entry.description}</td>
                      <td className="num">{formatCurrency(total)}</td>
                      <td>
                        <StatusSeal tone={STATUS_SEAL_TONE[entry.status]} label={STATUS_LABELS[entry.status]} />
                      </td>
                      <td>
                        <div className="btn-row">
                          <button type="button" className="btn btn-small" onClick={() => toggleExpand(entry)}>
                            {expandedId === entry.id ? 'Ocultar' : 'Ver detalle'}
                          </button>
                          {canRecord && entry.status === 'DRAFT' && (
                            <button type="button" className="btn btn-small" onClick={() => runAction(entry, 'submit')}>
                              Enviar a aprobación
                            </button>
                          )}
                          {canApprove && entry.status === 'PENDING_APPROVAL' && (
                            <button type="button" className="btn btn-small" onClick={() => runAction(entry, 'approve')}>
                              Aprobar
                            </button>
                          )}
                          {canRecord && entry.status === 'APPROVED' && (
                            <button type="button" className="btn btn-small" onClick={() => runAction(entry, 'reverse')}>
                              Reversar
                            </button>
                          )}
                          {canRecord && entry.status === 'DRAFT' && (
                            <button type="button" className="btn btn-small btn-danger" onClick={() => runAction(entry, 'remove')}>
                              Eliminar
                            </button>
                          )}
                        </div>
                        {actionError[entry.id] && (
                          <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                            {actionError[entry.id]}
                          </p>
                        )}
                      </td>
                    </tr>
                    {expandedId === entry.id && expandedEntry && (
                      <tr>
                        <td colSpan={6}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Cuenta</th>
                                <th className="num">Débito</th>
                                <th className="num">Crédito</th>
                                <th>Descripción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expandedEntry.lines.map((line) => (
                                <tr key={line.id}>
                                  <td>
                                    {line.account.code} · {line.account.name}
                                  </td>
                                  <td className="num">{formatCurrency(line.debit)}</td>
                                  <td className="num">{formatCurrency(line.credit)}</td>
                                  <td>{line.description || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {quickCreateAccount && (
        <QuickCreateModal
          title="Crear cuenta contable"
          fields={ACCOUNT_QUICK_CREATE_FIELDS}
          initialValues={{ name: quickCreateAccount.term }}
          onSubmit={(values) => accountsApi.create({ ...values, isPostable: true })}
          onSuccess={(created) => {
            setAccounts((prev) => [...prev, created]);
            updateLine(quickCreateAccount.lineIndex, { accountId: created.id });
            setAccountFlash({ lineIndex: quickCreateAccount.lineIndex, accountId: created.id });
            setQuickCreateAccount(null);
            recentlyUsedApi.record('account', created.id).catch(() => {});
          }}
          onCancel={() => setQuickCreateAccount(null)}
        />
      )}
    </div>
  );
}
