import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { treasuryAccountsApi, bankFeedsApi, reconciliationsApi } from '../../api/treasury';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import FilterBuilder from '../../components/FilterBuilder';
import StatusSeal from '../../core/ui/StatusSeal';
import DataTable from '../../core/ui/DataTable';
import EmptyState from '../../core/ui/EmptyState';

const STATUS_LABELS = { UNMATCHED: 'Sin conciliar', MATCHED: 'Conciliado', IGNORED: 'Ignorado' };
const STATUS_SEAL_TONE = { UNMATCHED: 'warning', MATCHED: 'positive', IGNORED: 'neutral' };
const RECON_STATUS_LABELS = { IN_PROGRESS: 'En curso', COMPLETED: 'Completada' };
const RECON_STATUS_SEAL_TONE = { IN_PROGRESS: 'warning', COMPLETED: 'positive' };

const TRANSACTION_FILTER_FIELDS = [
  { key: 'description', label: 'Descripción', type: 'text' },
  { key: 'date', label: 'Fecha', type: 'date' },
  { key: 'amount', label: 'Monto', type: 'number' },
  { key: 'currency', label: 'Moneda', type: 'text' },
  {
    key: 'status',
    label: 'Estado',
    type: 'select',
    options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
  },
];

export default function ReconciliationPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = user?.role === 'ADMIN';
  const canImport = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [bankAccounts, setBankAccounts] = useState([]);
  const [glAccounts, setGlAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importForm, setImportForm] = useState({ treasuryAccountId: '', source: 'CSV', fileName: '', fileContent: '' });
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [isStartOpen, setIsStartOpen] = useState(false);
  const [startForm, setStartForm] = useState({
    treasuryAccountId: '',
    periodStart: toIsoDate(new Date()),
    periodEnd: toIsoDate(new Date()),
    statementStartingBalance: '',
    statementEndingBalance: '',
  });
  const [startError, setStartError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [expandedRecon, setExpandedRecon] = useState(null);
  const [reconActionError, setReconActionError] = useState('');
  const [matchForm, setMatchForm] = useState({ bankTransactionId: '', offsetAccountId: '', description: '' });

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [accountsData, glData, transactionsData, reconData] = await Promise.all([
        treasuryAccountsApi.list({ type: 'BANK_ACCOUNT' }),
        accountsApi.list({ isActive: true }),
        bankFeedsApi.listTransactions({}),
        reconciliationsApi.list(),
      ]);
      setBankAccounts(accountsData);
      setGlAccounts(glData.filter((a) => a.isPostable));
      setTransactions(transactionsData);
      setReconciliations(reconData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la conciliación bancaria.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleImport(event) {
    event.preventDefault();
    setImportError('');
    setImportResult('');
    setIsImporting(true);
    try {
      const result = await bankFeedsApi.import(importForm);
      setImportResult(`Importados: ${result.imported ?? result.length ?? 'ok'}`);
      setImportForm({ treasuryAccountId: '', source: 'CSV', fileName: '', fileContent: '' });
      await loadAll();
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'No se pudo importar el archivo.');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleStart(event) {
    event.preventDefault();
    setStartError('');
    setIsStarting(true);
    try {
      await reconciliationsApi.start({
        ...startForm,
        statementStartingBalance: Number(startForm.statementStartingBalance),
        statementEndingBalance: Number(startForm.statementEndingBalance),
      });
      setIsStartOpen(false);
      await loadAll();
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'No se pudo iniciar la conciliación.');
    } finally {
      setIsStarting(false);
    }
  }

  async function toggleExpand(recon) {
    if (expandedId === recon.id) {
      setExpandedId(null);
      setExpandedRecon(null);
      return;
    }
    setExpandedId(recon.id);
    setReconActionError('');
    try {
      const full = await reconciliationsApi.getOne(recon.id);
      setExpandedRecon(full);
    } catch {
      setExpandedRecon(null);
    }
  }

  async function refreshExpanded() {
    if (!expandedId) return;
    const full = await reconciliationsApi.getOne(expandedId);
    setExpandedRecon(full);
    await loadAll();
  }

  async function handleAutoMatch() {
    setReconActionError('');
    try {
      await reconciliationsApi.autoMatch(expandedId);
      await refreshExpanded();
    } catch (err) {
      setReconActionError(err instanceof ApiError ? err.message : 'No se pudo correr el emparejamiento automático.');
    }
  }

  async function handleMatchWithNewEntry(event) {
    event.preventDefault();
    setReconActionError('');
    try {
      await reconciliationsApi.matchWithNewEntry(expandedId, matchForm);
      setMatchForm({ bankTransactionId: '', offsetAccountId: '', description: '' });
      await refreshExpanded();
    } catch (err) {
      setReconActionError(err instanceof ApiError ? err.message : 'No se pudo generar el asiento.');
    }
  }

  async function handleReverseMatch(matchId) {
    const ok = await confirm({
      title: 'Deshacer emparejamiento',
      message: 'Vas a deshacer este emparejamiento. El movimiento bancario volverá a quedar sin conciliar.',
      confirmLabel: 'Deshacer',
      tone: 'danger',
    });
    if (!ok) return;
    setReconActionError('');
    try {
      await reconciliationsApi.reverseMatch(expandedId, matchId);
      await refreshExpanded();
    } catch (err) {
      setReconActionError(err instanceof ApiError ? err.message : 'No se pudo deshacer el emparejamiento.');
    }
  }

  async function handleComplete() {
    const ok = await confirm({
      title: 'Completar conciliación',
      message: 'Vas a marcar esta conciliación como completada. Podrás seguir viéndola, pero ya no se le podrán agregar más emparejamientos.',
      confirmLabel: 'Completar',
    });
    if (!ok) return;
    setReconActionError('');
    try {
      const result = await reconciliationsApi.complete(expandedId);
      setReconActionError(
        Number(result.balanceDiscrepancy) !== 0
          ? `Completada con una diferencia de ${formatCurrency(result.balanceDiscrepancy)}.`
          : ''
      );
      await refreshExpanded();
    } catch (err) {
      setReconActionError(err instanceof ApiError ? err.message : 'No se pudo completar la conciliación.');
    }
  }

  const transactionColumns = useMemo(
    () => [
      { key: 'date', label: 'Fecha', value: (t) => formatDate(new Date(t.date)), defaultWidth: 110 },
      { key: 'description', label: 'Descripción', value: (t) => t.description, defaultWidth: 260 },
      { key: 'amount', label: 'Monto', align: 'num', value: (t) => formatCurrency(t.amount, t.currency), defaultWidth: 130 },
      {
        key: 'status',
        label: 'Estado',
        value: (t) => STATUS_LABELS[t.status],
        render: (t) => <StatusSeal tone={STATUS_SEAL_TONE[t.status]} label={STATUS_LABELS[t.status]} />,
        defaultWidth: 150,
      },
    ],
    []
  );

  const exceptions = expandedRecon
    ? transactions.filter((t) => t.status === 'UNMATCHED' && t.treasuryAccountId === expandedRecon.treasuryAccountId)
    : [];

  return (
    <div className="page">
      {canImport && (
        <div className="panel">
          <div className="panel-header">
            <h2>Importar movimientos bancarios</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsImportOpen((v) => !v)}>
              {isImportOpen ? 'Cancelar' : '+ Importar archivo'}
            </button>
          </div>
          {isImportOpen && (
            <form onSubmit={handleImport}>
              <div className="form-grid">
                <label className="field">
                  <span>Cuenta bancaria</span>
                  <select
                    value={importForm.treasuryAccountId}
                    onChange={(e) => setImportForm({ ...importForm, treasuryAccountId: e.target.value })}
                    required
                  >
                    <option value="">Selecciona una cuenta</option>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">
                    Formato
                    <HelpTooltip text="El tipo de archivo que exporta tu banco. CSV es el más común (una tabla de texto simple, como Excel). OFX y MT940 son formatos más técnicos que algunos bancos usan — si no sabes cuál es, prueba CSV primero." />
                  </span>
                  <select value={importForm.source} onChange={(e) => setImportForm({ ...importForm, source: e.target.value })}>
                    <option value="CSV">CSV</option>
                    <option value="OFX">OFX</option>
                    <option value="MT940">MT940</option>
                  </select>
                </label>
                <label className="field">
                  <span>Nombre del archivo (opcional)</span>
                  <input value={importForm.fileName} onChange={(e) => setImportForm({ ...importForm, fileName: e.target.value })} />
                </label>
              </div>
              <label className="field" style={{ marginTop: 12 }}>
                <span>Contenido del archivo (pega el texto del CSV/OFX/MT940)</span>
                <textarea
                  rows={6}
                  value={importForm.fileContent}
                  onChange={(e) => setImportForm({ ...importForm, fileContent: e.target.value })}
                  required
                />
              </label>
              {importError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{importError}</p>}
              {importResult && <p className="alert-box alert-box-success" style={{ marginTop: 12 }}>{importResult}</p>}
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={isImporting}>
                  {isImporting ? 'Importando…' : 'Importar'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Movimientos bancarios</h2>
        </div>
        {!isLoading && !loadError && transactions.length > 0 && (
          <FilterBuilder
            tableKey="bank-transactions"
            fields={TRANSACTION_FILTER_FIELDS}
            data={transactions}
            onFilteredChange={setFilteredTransactions}
          />
        )}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {(isLoading || !loadError) && (
          <DataTable
            tableKey="bank-transactions"
            columns={transactionColumns}
            data={filteredTransactions.slice(0, 30)}
            rowKey={(t) => t.id}
            isLoading={isLoading}
            emptyIcon="○"
            emptyMessage={
              transactions.length === 0 ? 'Todavía no importaste ningún movimiento bancario.' : 'Ningún resultado con estos filtros.'
            }
            exportTitle="Movimientos Bancarios"
          />
        )}
        {!isLoading && !loadError && filteredTransactions.length > 30 && (
          <p className="text-muted" style={{ marginTop: 8 }}>
            Mostrando los primeros 30 de {filteredTransactions.length} movimientos.
          </p>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Conciliaciones
            <HelpTooltip text="Conciliar es comparar los movimientos que reporta el banco contra lo que ya tienes registrado en el sistema, para confirmar que coinciden — así detectas cargos que faltan por registrar o errores." />
          </h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsStartOpen((v) => !v)}>
              {isStartOpen ? 'Cancelar' : '+ Iniciar conciliación'}
            </button>
          )}
        </div>

        {canManage && isStartOpen && (
          <form onSubmit={handleStart} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>Cuenta bancaria</span>
                <select
                  value={startForm.treasuryAccountId}
                  onChange={(e) => setStartForm({ ...startForm, treasuryAccountId: e.target.value })}
                  required
                >
                  <option value="">Selecciona una cuenta</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Desde</span>
                <input
                  type="date"
                  value={startForm.periodStart}
                  onChange={(e) => setStartForm({ ...startForm, periodStart: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={startForm.periodEnd}
                  onChange={(e) => setStartForm({ ...startForm, periodEnd: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">
                  Saldo inicial del extracto
                  <HelpTooltip text="El saldo que muestra el estado de cuenta del banco (el “extracto”) al empezar el periodo — lo copias directo del documento que te dio el banco." />
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={startForm.statementStartingBalance}
                  onChange={(e) => setStartForm({ ...startForm, statementStartingBalance: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Saldo final del extracto</span>
                <input
                  type="number"
                  step="0.01"
                  value={startForm.statementEndingBalance}
                  onChange={(e) => setStartForm({ ...startForm, statementEndingBalance: e.target.value })}
                  required
                />
              </label>
            </div>
            {startError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{startError}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isStarting}>
                {isStarting ? 'Iniciando…' : 'Iniciar conciliación'}
              </button>
            </div>
          </form>
        )}

        {!isLoading && !loadError && reconciliations.length === 0 && (
          <EmptyState icon="□" message="Todavía no iniciaste ninguna conciliación." />
        )}
        {!isLoading && !loadError && reconciliations.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reconciliations.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td>
                      {formatDate(new Date(r.periodStart))} — {formatDate(new Date(r.periodEnd))}
                    </td>
                    <td>
                      <StatusSeal tone={RECON_STATUS_SEAL_TONE[r.status]} label={RECON_STATUS_LABELS[r.status]} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => toggleExpand(r)}>
                        {expandedId === r.id ? 'Ocultar' : 'Ver detalle'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === r.id && expandedRecon && (
                    <tr>
                      <td colSpan={3}>
                        {reconActionError && (
                          <p className="alert-box alert-box-error" style={{ marginBottom: 12 }}>
                            {reconActionError}
                          </p>
                        )}
                        {canManage && expandedRecon.status === 'IN_PROGRESS' && (
                          <div className="btn-row" style={{ marginBottom: 16 }}>
                            <button type="button" className="btn btn-small" onClick={handleAutoMatch}>
                              Emparejar automáticamente
                            </button>
                            <button type="button" className="btn btn-small btn-primary" onClick={handleComplete}>
                              Completar conciliación
                            </button>
                          </div>
                        )}

                        <p className="section-title">Emparejamientos</p>
                        <table className="data-table" style={{ marginBottom: 16 }}>
                          <thead>
                            <tr>
                              <th>Movimiento bancario</th>
                              <th>Tipo</th>
                              <th>Estado</th>
                              {canManage && <th></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {expandedRecon.matches.length === 0 && (
                              <tr>
                                <td colSpan={4} className="data-table-empty">
                                  Sin emparejamientos todavía.
                                </td>
                              </tr>
                            )}
                            {expandedRecon.matches.map((m) => (
                              <tr key={m.id}>
                                <td>
                                  {m.bankTransaction.description} ({formatCurrency(m.bankTransaction.amount, m.bankTransaction.currency)})
                                </td>
                                <td>{m.matchType === 'AUTOMATIC' ? 'Automático' : 'Manual'}</td>
                                <td>
                                  <StatusSeal
                                    status={m.status === 'ACTIVE' ? 'active' : 'rejected'}
                                    label={m.status === 'ACTIVE' ? 'Activo' : 'Reversado'}
                                  />
                                </td>
                                {canManage && (
                                  <td>
                                    {m.status === 'ACTIVE' && expandedRecon.status === 'IN_PROGRESS' && (
                                      <button type="button" className="btn btn-small btn-danger" onClick={() => handleReverseMatch(m.id)}>
                                        Deshacer
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {canManage && expandedRecon.status === 'IN_PROGRESS' && (
                          <>
                            <p className="section-title field-label">
                              Generar asiento para un movimiento sin conciliar
                              <HelpTooltip text="Úsalo cuando el banco muestra un movimiento (ej. una comisión) que todavía no está registrado en el sistema. Se crea el asiento contable correspondiente y queda conciliado de una vez." />
                            </p>
                            <form onSubmit={handleMatchWithNewEntry} className="form-grid">
                              <label className="field">
                                <span>Movimiento</span>
                                <select
                                  value={matchForm.bankTransactionId}
                                  onChange={(e) => setMatchForm({ ...matchForm, bankTransactionId: e.target.value })}
                                  required
                                >
                                  <option value="">Selecciona un movimiento</option>
                                  {exceptions.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {formatDate(new Date(t.date))} · {t.description} · {formatCurrency(t.amount, t.currency)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                <span className="field-label">
                                  Cuenta contable contraparte
                                  <HelpTooltip text="La otra cuenta del asiento (además del banco). Ej. si el movimiento es una comisión bancaria, aquí eliges la cuenta de gasto “Comisiones Bancarias”." />
                                </span>
                                <select
                                  value={matchForm.offsetAccountId}
                                  onChange={(e) => setMatchForm({ ...matchForm, offsetAccountId: e.target.value })}
                                  required
                                >
                                  <option value="">Selecciona una cuenta</option>
                                  {glAccounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.code} · {a.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                <span>Descripción (opcional)</span>
                                <input
                                  value={matchForm.description}
                                  onChange={(e) => setMatchForm({ ...matchForm, description: e.target.value })}
                                />
                              </label>
                              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <button type="submit" className="btn btn-primary">
                                  Generar asiento y conciliar
                                </button>
                              </div>
                            </form>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
