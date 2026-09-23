import { Fragment, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { treasuryAccountsApi, pettyCashApi } from '../../api/treasury';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import AmountInput from '../../core/ui/AmountInput';
import BulkActionBar from '../../core/ui/BulkActionBar';
import { evaluateMathExpression } from '../../utils/mathExpression';

// Elegible para la barra de acciones masivas: la MISMA regla que ya
// usan los botones "Aprobar"/"Rechazar" de cada fila individual
// (maker-checker) — nunca una segunda versión de la regla que se
// pudiera desincronizar. El backend (petty-cash-approval.rules.js) es
// quien manda de verdad; esto es solo para decidir qué mostrar en la
// barra ANTES de ejecutar.
function isExpenseBulkEligible(expense, userId) {
  return expense.status === 'PENDING_APPROVAL' && expense.registeredByUserId !== userId;
}

const FUND_EMPTY_FORM = {
  name: '',
  initialAmount: '',
  replenishmentThreshold: '',
  glAccountId: '',
  treasuryAccountId: '',
};

const EXPENSE_EMPTY_FORM = {
  fundId: '',
  amount: '',
  description: '',
  expenseDate: toIsoDate(new Date()),
  category: '',
  expenseGlAccountId: '',
};

export default function PettyCashPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';
  const canApprove = user?.role === 'ADMIN';
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedExpenseIds, setSelectedExpenseIds] = useState(new Set());
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  const [funds, setFunds] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState([]);
  const [glAccounts, setGlAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFundFormOpen, setIsFundFormOpen] = useState(false);
  const [fundForm, setFundForm] = useState(FUND_EMPTY_FORM);
  const [fundError, setFundError] = useState('');
  const [replenishInputs, setReplenishInputs] = useState({});
  const [fundActionError, setFundActionError] = useState({});

  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(EXPENSE_EMPTY_FORM);
  const [expenseError, setExpenseError] = useState('');
  const [expenseActionError, setExpenseActionError] = useState({});

  // Botón flotante de creación rápida: si se llegó acá desde "Nuevo
  // gasto" en ese menú, el formulario se abre solo.
  useEffect(() => {
    if (location.state?.autoOpenCreate) {
      setIsExpenseFormOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [fundsData, expensesData, treasuryData, glData] = await Promise.all([
        pettyCashApi.listFunds({}),
        pettyCashApi.listExpenses({}),
        treasuryAccountsApi.list({ type: 'BANK_ACCOUNT' }),
        accountsApi.list({ isActive: true }),
      ]);
      setFunds(fundsData);
      setExpenses(expensesData);
      setTreasuryAccounts(treasuryData);
      setGlAccounts(glData.filter((a) => a.isPostable));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la caja chica.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreateFund(event) {
    event.preventDefault();
    setFundError('');
    try {
      await pettyCashApi.createFund({
        ...fundForm,
        custodianUserId: user.id,
        initialAmount: Number(fundForm.initialAmount),
        replenishmentThreshold: Number(fundForm.replenishmentThreshold),
        treasuryAccountId: fundForm.treasuryAccountId || undefined,
      });
      setFundForm(FUND_EMPTY_FORM);
      setIsFundFormOpen(false);
      await loadAll();
    } catch (err) {
      setFundError(err instanceof ApiError ? err.message : 'No se pudo crear el fondo.');
    }
  }

  async function handleReplenish(fund) {
    const amount = replenishInputs[fund.id];
    if (!amount) return;
    setFundActionError((prev) => ({ ...prev, [fund.id]: '' }));
    try {
      await pettyCashApi.replenish(fund.id, Number(amount));
      setReplenishInputs((prev) => ({ ...prev, [fund.id]: '' }));
      await loadAll();
    } catch (err) {
      setFundActionError((prev) => ({ ...prev, [fund.id]: err instanceof ApiError ? err.message : 'No se pudo reponer el fondo.' }));
    }
  }

  async function handleRegisterExpense(event) {
    event.preventDefault();
    setExpenseError('');
    try {
      const resolvedAmount = evaluateMathExpression(expenseForm.amount) ?? Number(expenseForm.amount);
      await pettyCashApi.registerExpense({ ...expenseForm, amount: resolvedAmount });
      setExpenseForm(EXPENSE_EMPTY_FORM);
      setIsExpenseFormOpen(false);
      await loadAll();
    } catch (err) {
      setExpenseError(err instanceof ApiError ? err.message : 'No se pudo registrar el gasto.');
    }
  }

  // Divisor de gastos (innovación pedida explícitamente): en vez de un
  // solo gasto por el monto completo, registra uno por cada parte —
  // mismo fondo/fecha/categoría/cuenta, con la descripción marcada
  // "(i/N)" para poder distinguirlos después en el listado.
  async function handleApplyExpenseSplit(splitInfo) {
    setExpenseError('');
    try {
      for (let i = 1; i <= splitInfo.parts; i++) {
        await pettyCashApi.registerExpense({
          ...expenseForm,
          amount: splitInfo.perPart,
          description: `${expenseForm.description} (${i}/${splitInfo.parts})`,
        });
      }
      setExpenseForm(EXPENSE_EMPTY_FORM);
      setIsExpenseFormOpen(false);
      await loadAll();
    } catch (err) {
      setExpenseError(err instanceof ApiError ? err.message : 'No se pudo registrar el reparto del gasto.');
    }
  }

  // Acción "Duplicar" (Feature H): precarga el formulario de gasto con
  // los mismos datos (fondo, monto, categoría, cuenta, descripción) pero
  // con la fecha de hoy — un gasto de caja chica no tiene un estado
  // Borrador persistido (solo PENDING_APPROVAL/APPROVED/REJECTED, ver
  // CLAUDE.md), así que el propio formulario ya precargado y todavía
  // sin enviar cumple ese rol. A diferencia de las facturas de venta,
  // acá no se sugiere recurrencia automática: un gasto de caja chica no
  // tiene el concepto de "cliente" que la detección de patrón necesita.
  function handleDuplicateExpense(expense) {
    setExpenseForm({
      fundId: expense.fundId,
      amount: String(expense.amount),
      description: expense.description,
      expenseDate: toIsoDate(new Date()),
      category: expense.category || '',
      expenseGlAccountId: expense.expenseGlAccountId,
    });
    setIsExpenseFormOpen(true);
  }

  async function handleDecideExpense(expense, decision) {
    setExpenseActionError((prev) => ({ ...prev, [expense.id]: '' }));
    try {
      await pettyCashApi.decideExpense(expense.id, { decision });
      await loadAll();
    } catch (err) {
      setExpenseActionError((prev) => ({
        ...prev,
        [expense.id]: err instanceof ApiError ? err.message : 'No se pudo decidir sobre el gasto.',
      }));
    }
  }

  function toggleExpenseSelected(id) {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllExpensesSelected() {
    setSelectedExpenseIds((prev) => (prev.size === expenses.length ? new Set() : new Set(expenses.map((e) => e.id))));
  }

  // Barra de acciones masivas (Feature P): la selección puede traer
  // ids elegibles y no elegibles mezclados a propósito — nunca se
  // revalida acá si un gasto es aprobable, eso lo decide el backend
  // (petty-cash-approval.rules.js) por cada id, uno por uno, y devuelve
  // qué pasó con cada uno. Nunca es un éxito/fracaso silencioso de
  // todo el lote.
  async function handleBulkDecide(decision) {
    setIsBulkRunning(true);
    const ids = Array.from(selectedExpenseIds);
    try {
      const { results } = await pettyCashApi.bulkDecideExpenses(ids, decision);
      const doneCount = results.filter((r) => r.status === 'done').length;
      const skipped = results.filter((r) => r.status === 'skipped');
      const verb = decision === 'APPROVED' ? 'aprobado' : 'rechazado';
      setSelectedExpenseIds(new Set());
      await loadAll();
      showToast({
        message:
          skipped.length === 0
            ? `${doneCount} gasto(s) ${verb}(s).`
            : `${doneCount} ${verb}(s) · ${skipped.length} no se pudo(eron) procesar: ${skipped[0].reason}${skipped.length > 1 ? ` (y ${skipped.length - 1} más)` : ''}`,
        durationMs: 8000,
      });
    } catch (err) {
      showToast({ message: err instanceof ApiError ? err.message : 'No se pudo procesar el lote.' });
    } finally {
      setIsBulkRunning(false);
    }
  }

  const selectedExpenses = expenses.filter((e) => selectedExpenseIds.has(e.id));
  const eligibleSelectedCount = selectedExpenses.filter((e) => isExpenseBulkEligible(e, user?.id)).length;

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Fondos de caja chica</h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFundFormOpen((v) => !v)}>
              {isFundFormOpen ? 'Cancelar' : '+ Nuevo fondo'}
            </button>
          )}
        </div>
        {canManage && isFundFormOpen && (
          <form onSubmit={handleCreateFund} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Quedarás como responsable (custodio) de este fondo.
            </p>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input value={fundForm.name} onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })} placeholder="Caja Chica Oficina" required />
              </label>
              <label className="field">
                <span>Monto inicial</span>
                <input
                  type="number"
                  step="0.01"
                  value={fundForm.initialAmount}
                  onChange={(e) => setFundForm({ ...fundForm, initialAmount: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">
                  Umbral de reposición
                  <HelpTooltip text="Cuando el saldo del fondo baje de este monto, el sistema puede avisar que ya es momento de reponerlo (traer más efectivo desde el banco)." />
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={fundForm.replenishmentThreshold}
                  onChange={(e) => setFundForm({ ...fundForm, replenishmentThreshold: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">
                  Cuenta contable de caja chica
                  <HelpTooltip text="La cuenta del Plan de Cuentas que representa este efectivo (ej. “Caja Chica”), para que los movimientos queden reflejados en los reportes." />
                </span>
                <select value={fundForm.glAccountId} onChange={(e) => setFundForm({ ...fundForm, glAccountId: e.target.value })} required>
                  <option value="">Selecciona una cuenta</option>
                  {glAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Cuenta bancaria de reposición (opcional)</span>
                <select value={fundForm.treasuryAccountId} onChange={(e) => setFundForm({ ...fundForm, treasuryAccountId: e.target.value })}>
                  <option value="">Sin asociar</option>
                  {treasuryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {fundError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{fundError}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary">
                Crear fondo
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && funds.length === 0 && (
          <EmptyState icon="◆" message="Todavía no creaste ningún fondo de caja chica." />
        )}
        {!isLoading && !loadError && funds.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th className="num">Saldo actual</th>
                <th>Estado</th>
                {canManage && <th>Reponer</th>}
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td className="num">{formatCurrency(f.currentBalance)}</td>
                  <td>
                    <StatusSeal status={f.status === 'ACTIVE' ? 'active' : 'closed'} label={f.status === 'ACTIVE' ? 'Activo' : 'Cerrado'} />
                  </td>
                  {canManage && (
                    <td>
                      <div className="btn-row">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Monto"
                          value={replenishInputs[f.id] || ''}
                          onChange={(e) => setReplenishInputs((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          style={{
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 9px',
                            width: 100,
                          }}
                        />
                        <button type="button" className="btn btn-small" onClick={() => handleReplenish(f)}>
                          Reponer
                        </button>
                      </div>
                      {fundActionError[f.id] && <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>{fundActionError[f.id]}</p>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Gastos de caja chica</h2>
          <button type="button" className="btn btn-primary btn-small" onClick={() => setIsExpenseFormOpen((v) => !v)}>
            {isExpenseFormOpen ? 'Cancelar' : '+ Registrar gasto'}
          </button>
        </div>
        {isExpenseFormOpen && (
          <form onSubmit={handleRegisterExpense} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>Fondo</span>
                <select value={expenseForm.fundId} onChange={(e) => setExpenseForm({ ...expenseForm, fundId: e.target.value })} required>
                  <option value="">Selecciona un fondo</option>
                  {funds
                    .filter((f) => f.status === 'ACTIVE')
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Monto
                  <HelpTooltip text="Puedes escribir una operación simple (ej. “150+30”) y se calcula sola al salir del campo. Si escribes un reparto como “300/3”, se ofrece dividir el gasto en varios." />
                </span>
                <AmountInput
                  value={expenseForm.amount}
                  onChange={(text) => setExpenseForm({ ...expenseForm, amount: text })}
                  onApplySplit={handleApplyExpenseSplit}
                  splitLabel="gastos"
                  required
                />
              </label>
              <label className="field">
                <span>Fecha</span>
                <input type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })} required />
              </label>
              <label className="field">
                <span>Categoría (opcional)</span>
                <input value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} />
              </label>
              <label className="field">
                <span>Cuenta de gasto</span>
                <select
                  value={expenseForm.expenseGlAccountId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expenseGlAccountId: e.target.value })}
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
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span>Descripción</span>
                <input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} required />
              </label>
            </div>
            {expenseError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{expenseError}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary">
                Registrar gasto
              </button>
            </div>
          </form>
        )}

        {!isLoading && !loadError && expenses.length === 0 && (
          <EmptyState icon="○" message="Todavía no registraste ningún gasto de caja chica." />
        )}
        {!isLoading && !loadError && expenses.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                {canApprove && (
                  <th style={{ width: 28 }}>
                    <input
                      type="checkbox"
                      checked={expenses.length > 0 && selectedExpenseIds.size === expenses.length}
                      onChange={toggleAllExpensesSelected}
                      title="Seleccionar todos"
                    />
                  </th>
                )}
                <th>Fecha</th>
                <th>Descripción</th>
                <th className="num">Monto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <Fragment key={e.id}>
                  <tr>
                    {canApprove && (
                      <td>
                        <input type="checkbox" checked={selectedExpenseIds.has(e.id)} onChange={() => toggleExpenseSelected(e.id)} />
                      </td>
                    )}
                    <td>{formatDate(new Date(e.expenseDate))}</td>
                    <td>{e.description}</td>
                    <td className="num">{formatCurrency(e.amount)}</td>
                    <td>
                      <StatusSeal
                        status={e.status === 'APPROVED' ? 'approved' : e.status === 'REJECTED' ? 'rejected' : 'pending'}
                        label={e.status === 'APPROVED' ? 'Aprobado' : e.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                      />
                    </td>
                    <td>
                      <div className="btn-row" style={{ flexWrap: 'nowrap' }}>
                        {canApprove && e.status === 'PENDING_APPROVAL' && e.registeredByUserId !== user.id && (
                          <>
                            <button type="button" className="btn btn-small btn-primary" onClick={() => handleDecideExpense(e, 'APPROVED')}>
                              Aprobar
                            </button>
                            <button type="button" className="btn btn-small btn-danger" onClick={() => handleDecideExpense(e, 'REJECTED')}>
                              Rechazar
                            </button>
                          </>
                        )}
                        {canManage && (
                          <button type="button" className="btn btn-small" onClick={() => handleDuplicateExpense(e)}>
                            Duplicar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expenseActionError[e.id] && (
                    <tr>
                      <td colSpan={canApprove ? 6 : 5}>
                        <p className="alert-box alert-box-error">{expenseActionError[e.id]}</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canApprove && (
        <BulkActionBar
          selectedCount={selectedExpenses.length}
          eligibleCount={eligibleSelectedCount}
          onClear={() => setSelectedExpenseIds(new Set())}
          isRunning={isBulkRunning}
          actions={[
            { key: 'approve', label: `Aprobar (${eligibleSelectedCount})`, onRun: () => handleBulkDecide('APPROVED') },
            { key: 'reject', label: `Rechazar (${eligibleSelectedCount})`, tone: 'danger', onRun: () => handleBulkDecide('REJECTED') },
          ]}
        />
      )}
    </div>
  );
}
