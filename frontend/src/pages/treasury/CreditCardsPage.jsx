import { useCallback, useEffect, useState } from 'react';
import { treasuryAccountsApi, creditCardsApi, pettyCashApi } from '../../api/treasury';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

export default function CreditCardsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [cards, setCards] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pettyCashExpenses, setPettyCashExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importForm, setImportForm] = useState({ treasuryAccountId: '', fileName: '', fileContent: '' });
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [rowError, setRowError] = useState({});
  const [matchSelection, setMatchSelection] = useState({});

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [cardsData, transactionsData, expensesData] = await Promise.all([
        treasuryAccountsApi.list({ type: 'CREDIT_CARD' }),
        creditCardsApi.list({}),
        pettyCashApi.listExpenses({}),
      ]);
      setCards(cardsData);
      setTransactions(transactionsData);
      setPettyCashExpenses(expensesData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la información de tarjetas.');
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
    setIsImporting(true);
    try {
      await creditCardsApi.import(importForm);
      setImportForm({ treasuryAccountId: '', fileName: '', fileContent: '' });
      setIsImportOpen(false);
      await loadAll();
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'No se pudo importar el archivo.');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleFlag(transaction, changes) {
    setRowError((prev) => ({ ...prev, [transaction.id]: '' }));
    try {
      await creditCardsApi.flag(transaction.id, {
        hasReceipt: changes.hasReceipt ?? transaction.hasReceipt,
        isPolicyViolation: changes.isPolicyViolation ?? transaction.isPolicyViolation,
      });
      await loadAll();
    } catch (err) {
      setRowError((prev) => ({ ...prev, [transaction.id]: err instanceof ApiError ? err.message : 'No se pudo actualizar.' }));
    }
  }

  async function handleMatchPettyCash(transaction) {
    const expenseId = matchSelection[transaction.id];
    if (!expenseId) return;
    setRowError((prev) => ({ ...prev, [transaction.id]: '' }));
    try {
      await creditCardsApi.matchPettyCash(transaction.id, expenseId);
      await loadAll();
    } catch (err) {
      setRowError((prev) => ({ ...prev, [transaction.id]: err instanceof ApiError ? err.message : 'No se pudo cruzar el gasto.' }));
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2>Importar movimientos de tarjeta</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsImportOpen((v) => !v)}>
              {isImportOpen ? 'Cancelar' : '+ Importar archivo'}
            </button>
          </div>
          {isImportOpen && (
            <form onSubmit={handleImport}>
              <div className="form-grid">
                <label className="field">
                  <span>Tarjeta</span>
                  <select
                    value={importForm.treasuryAccountId}
                    onChange={(e) => setImportForm({ ...importForm, treasuryAccountId: e.target.value })}
                    required
                  >
                    <option value="">Selecciona una tarjeta</option>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Nombre del archivo (opcional)</span>
                  <input value={importForm.fileName} onChange={(e) => setImportForm({ ...importForm, fileName: e.target.value })} />
                </label>
              </div>
              <label className="field" style={{ marginTop: 12 }}>
                <span>Contenido del archivo (CSV)</span>
                <textarea
                  rows={6}
                  value={importForm.fileContent}
                  onChange={(e) => setImportForm({ ...importForm, fileContent: e.target.value })}
                  required
                />
              </label>
              {importError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{importError}</p>}
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
          <h2>Movimientos de tarjeta</h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && transactions.length === 0 && (
          <EmptyState icon="○" message="Todavía no importaste ningún movimiento de tarjeta." />
        )}
        {!isLoading && !loadError && transactions.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Comercio</th>
                <th className="num">Monto</th>
                <th>
                  <span className="field-label">
                    Comprobante
                    <HelpTooltip text="Marca esta casilla cuando ya tengas la factura o recibo de esta compra guardado, para llevar el control de qué gastos todavía faltan justificar." />
                  </span>
                </th>
                <th>
                  <span className="field-label">
                    Política
                    <HelpTooltip text="Marca esta casilla si este gasto no debió hacerse según las reglas internas de la empresa (ej. un gasto personal, o por encima del límite permitido)." />
                  </span>
                </th>
                <th>Estado</th>
                {canManage && (
                  <th>
                    <span className="field-label">
                      Cruzar con gasto de caja chica
                      <HelpTooltip text="Si este cargo de tarjeta corresponde a un gasto que un empleado ya registró en Caja Chica, únelos aquí para no contar el mismo gasto dos veces." />
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 30).map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(new Date(t.date))}</td>
                  <td>{t.merchant}</td>
                  <td className="num">{formatCurrency(t.amount, t.currency)}</td>
                  <td>
                    {canManage ? (
                      <input type="checkbox" checked={t.hasReceipt} onChange={(e) => handleFlag(t, { hasReceipt: e.target.checked })} />
                    ) : (
                      <StatusSeal status={t.hasReceipt ? 'active' : 'inactive'} label={t.hasReceipt ? 'Sí' : 'No'} />
                    )}
                  </td>
                  <td>
                    {canManage ? (
                      <input
                        type="checkbox"
                        checked={t.isPolicyViolation}
                        onChange={(e) => handleFlag(t, { isPolicyViolation: e.target.checked })}
                      />
                    ) : (
                      <StatusSeal status={t.isPolicyViolation ? 'rejected' : 'active'} label={t.isPolicyViolation ? 'Sí' : 'No'} />
                    )}
                  </td>
                  <td>
                    <StatusSeal
                      status={t.matchStatus === 'MATCHED' ? 'active' : 'pending'}
                      label={t.matchStatus === 'MATCHED' ? 'Cruzado' : 'Sin cruzar'}
                    />
                  </td>
                  {canManage && (
                    <td>
                      {t.matchStatus === 'UNMATCHED' && (
                        <div className="btn-row">
                          <select
                            value={matchSelection[t.id] || ''}
                            onChange={(e) => setMatchSelection((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          >
                            <option value="">Selecciona un gasto</option>
                            {pettyCashExpenses.map((exp) => (
                              <option key={exp.id} value={exp.id}>
                                {exp.description} ({formatCurrency(exp.amount)})
                              </option>
                            ))}
                          </select>
                          <button type="button" className="btn btn-small" onClick={() => handleMatchPettyCash(t)}>
                            Cruzar
                          </button>
                        </div>
                      )}
                      {rowError[t.id] && <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>{rowError[t.id]}</p>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
