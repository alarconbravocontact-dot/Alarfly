import { Fragment, useEffect, useState } from 'react';
import { financialStatementsApi } from '../../api/reports';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate, toIsoDate, currentMonthRange } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';
import DateRangeSelector from '../../core/ui/DateRangeSelector';
import QuickExportButtons from '../../core/ui/QuickExportButtons';
import RecordLink from '../../core/ui/RecordLink';

const MODES = [
  { value: 'income-statement', label: 'Estado de Resultados' },
  { value: 'balance-sheet', label: 'Balance General' },
  { value: 'compare-income', label: 'Comparar Estado de Resultados' },
  { value: 'compare-balance', label: 'Comparar Balance General' },
];

const { from: defaultFrom, to: defaultTo } = currentMonthRange();

function VarianceLabel({ variance }) {
  const value = Number(variance.variance);
  const tone = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  return (
    <span className={`stat-card-value--${tone}`} style={{ fontSize: 13 }}>
      {value > 0 ? '+' : ''}
      {formatCurrency(variance.variance)} {variance.variancePercent !== null ? `(${variance.variancePercent}%)` : ''}
    </span>
  );
}

export default function FinancialStatementsPage() {
  const { user } = useAuth();
  const canSchedule = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const [mode, setMode] = useState('income-statement');
  const [asOfDate, setAsOfDate] = useState(toIsoDate(new Date()));
  const [range, setRange] = useState({ from: defaultFrom, to: defaultTo });
  const { from, to } = range;
  const [asOfDateA, setAsOfDateA] = useState(defaultFrom);
  const [asOfDateB, setAsOfDateB] = useState(toIsoDate(new Date()));
  const [fromA, setFromA] = useState(defaultFrom);
  const [toA, setToA] = useState(defaultTo);
  const [fromB, setFromB] = useState(defaultFrom);
  const [toB, setToB] = useState(defaultTo);

  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [accountIdByCode, setAccountIdByCode] = useState(new Map());
  const [drillDownCode, setDrillDownCode] = useState(null);
  const [drillDownData, setDrillDownData] = useState(null);
  const [isDrillLoading, setIsDrillLoading] = useState(false);

  useEffect(() => {
    accountsApi
      .list()
      .then((accounts) => setAccountIdByCode(new Map(accounts.map((a) => [a.code, a.id]))))
      .catch(() => setAccountIdByCode(new Map()));
  }, []);

  async function generate() {
    setIsLoading(true);
    setError('');
    setResult(null);
    setDrillDownCode(null);
    try {
      let data;
      if (mode === 'income-statement') data = await financialStatementsApi.incomeStatement(from, to);
      if (mode === 'balance-sheet') data = await financialStatementsApi.balanceSheet(asOfDate);
      if (mode === 'compare-income') data = await financialStatementsApi.compareIncomeStatement(fromA, toA, fromB, toB);
      if (mode === 'compare-balance') data = await financialStatementsApi.compareBalanceSheet(asOfDateA, asOfDateB);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el reporte.');
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleDrillDown(row) {
    if (drillDownCode === row.code) {
      setDrillDownCode(null);
      setDrillDownData(null);
      return;
    }
    const accountId = accountIdByCode.get(row.code);
    if (!accountId) return;
    setDrillDownCode(row.code);
    setIsDrillLoading(true);
    try {
      const data = await financialStatementsApi.drillDown(accountId, from, to);
      setDrillDownData(data);
    } catch {
      setDrillDownData(null);
    } finally {
      setIsDrillLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Generar reporte</h2>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Tipo</span>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setResult(null);
              }}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {mode === 'income-statement' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <DateRangeSelector value={range} onChange={setRange} />
            </div>
          )}

          {mode === 'balance-sheet' && (
            <label className="field">
              <span>Al día</span>
              <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            </label>
          )}

          {mode === 'compare-income' && (
            <>
              <label className="field">
                <span>Periodo A — desde</span>
                <input type="date" value={fromA} onChange={(e) => setFromA(e.target.value)} />
              </label>
              <label className="field">
                <span>Periodo A — hasta</span>
                <input type="date" value={toA} onChange={(e) => setToA(e.target.value)} />
              </label>
              <label className="field">
                <span>Periodo B — desde</span>
                <input type="date" value={fromB} onChange={(e) => setFromB(e.target.value)} />
              </label>
              <label className="field">
                <span>Periodo B — hasta</span>
                <input type="date" value={toB} onChange={(e) => setToB(e.target.value)} />
              </label>
            </>
          )}

          {mode === 'compare-balance' && (
            <>
              <label className="field">
                <span>Fecha A</span>
                <input type="date" value={asOfDateA} onChange={(e) => setAsOfDateA(e.target.value)} />
              </label>
              <label className="field">
                <span>Fecha B</span>
                <input type="date" value={asOfDateB} onChange={(e) => setAsOfDateB(e.target.value)} />
              </label>
            </>
          )}
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={isLoading}>
            {isLoading ? 'Generando…' : 'Generar'}
          </button>
        </div>
        {error && (
          <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
      </div>

      {result && mode === 'income-statement' && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Estado de Resultados
              <HelpTooltip text="Haz clic en cualquier cuenta para ver el detalle de los movimientos que la componen (su libro mayor)." />
            </h2>
            <QuickExportButtons reportType="income-statement" params={{ from, to }} canSchedule={canSchedule} />
          </div>
          {Object.entries(result.sections).map(([section, rows]) => (
            <table className="data-table" key={section} style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th colSpan={2}>{section}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.code}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggleDrillDown(row)}>
                      <td>
                        {row.code} · {row.name}
                      </td>
                      <td className="num">{formatCurrency(row.amount)}</td>
                    </tr>
                    {drillDownCode === row.code && (
                      <tr>
                        <td colSpan={2}>
                          {isDrillLoading && <p className="text-muted">Cargando detalle…</p>}
                          {!isDrillLoading && drillDownData && (
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Fecha</th>
                                  <th>N.º</th>
                                  <th>Descripción</th>
                                  <th className="num">Débito</th>
                                  <th className="num">Crédito</th>
                                </tr>
                              </thead>
                              <tbody>
                                {drillDownData.movements.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="text-muted">
                                      Sin movimientos en el rango indicado.
                                    </td>
                                  </tr>
                                )}
                                {drillDownData.movements.map((m, i) => (
                                  <tr key={i}>
                                    <td>{formatDate(new Date(m.date))}</td>
                                    <td>{m.entryNumber}</td>
                                    <td>{m.description}</td>
                                    <td className="num">{formatCurrency(m.debit)}</td>
                                    <td className="num">{formatCurrency(m.credit)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          ))}
          <table className="data-table">
            <tbody>
              <tr>
                <td>Ingresos totales</td>
                <td className="num">{formatCurrency(result.totalIncome)}</td>
              </tr>
              <tr>
                <td>Gastos totales</td>
                <td className="num">{formatCurrency(result.totalExpense)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Utilidad neta</strong>
                </td>
                <td className="num">
                  <strong>{formatCurrency(result.netIncome)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {result && mode === 'balance-sheet' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Balance General al {formatDate(new Date(`${asOfDate}T00:00:00`))}</h2>
          </div>
          {Object.entries(result.sections).map(([section, rows]) => (
            <table className="data-table" key={section} style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th colSpan={2}>{section}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code}>
                    <td>
                      <RecordLink type="account" id={accountIdByCode.get(row.code)}>
                        {row.code} · {row.name}
                      </RecordLink>
                    </td>
                    <td className="num">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
          <table className="data-table">
            <tbody>
              <tr>
                <td>Total Activos</td>
                <td className="num">{formatCurrency(result.totalAssets)}</td>
              </tr>
              <tr>
                <td>Total Pasivos</td>
                <td className="num">{formatCurrency(result.totalLiabilities)}</td>
              </tr>
              <tr>
                <td>Total Patrimonio</td>
                <td className="num">{formatCurrency(result.totalEquity)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Total Pasivo + Patrimonio</strong>
                </td>
                <td className="num">
                  <strong>{formatCurrency(result.totalLiabilitiesAndEquity)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {result && mode === 'compare-income' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Comparación del Estado de Resultados</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th className="num">Periodo A</th>
                <th className="num">Periodo B</th>
                <th className="num">Variación</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Ingresos totales</td>
                <td className="num">{formatCurrency(result.periodA.totalIncome)}</td>
                <td className="num">{formatCurrency(result.periodB.totalIncome)}</td>
                <td className="num"></td>
              </tr>
              <tr>
                <td>Gastos totales</td>
                <td className="num">{formatCurrency(result.periodA.totalExpense)}</td>
                <td className="num">{formatCurrency(result.periodB.totalExpense)}</td>
                <td className="num"></td>
              </tr>
              <tr>
                <td>
                  <strong>Utilidad neta</strong>
                </td>
                <td className="num">{formatCurrency(result.periodA.netIncome)}</td>
                <td className="num">{formatCurrency(result.periodB.netIncome)}</td>
                <td className="num">
                  <VarianceLabel variance={result.netIncomeChange} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {result && mode === 'compare-balance' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Comparación del Balance General</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th className="num">Fecha A</th>
                <th className="num">Fecha B</th>
                <th className="num">Variación</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Activos</td>
                <td className="num">{formatCurrency(result.periodA.totalAssets)}</td>
                <td className="num">{formatCurrency(result.periodB.totalAssets)}</td>
                <td className="num">
                  <VarianceLabel variance={result.totalAssetsChange} />
                </td>
              </tr>
              <tr>
                <td>Total Pasivos</td>
                <td className="num">{formatCurrency(result.periodA.totalLiabilities)}</td>
                <td className="num">{formatCurrency(result.periodB.totalLiabilities)}</td>
                <td className="num">
                  <VarianceLabel variance={result.totalLiabilitiesChange} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!result && !isLoading && !error && (
        <div className="panel">
          <EmptyState icon="▤" message="Elige un tipo de reporte y genera para ver los resultados." />
        </div>
      )}
    </div>
  );
}
