import { useEffect, useState } from 'react';
import { accountsApi, accountingReportsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate, toIsoDate, currentMonthRange } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';

const REPORT_TYPES = [
  { value: 'trial-balance', label: 'Balance de Comprobación' },
  { value: 'income-statement', label: 'Estado de Resultados' },
  { value: 'balance-sheet', label: 'Balance General' },
  { value: 'general-ledger', label: 'Libro Mayor de una cuenta' },
];

const REPORT_HELP =
  'Balance de Comprobación: lista todas las cuentas con movimiento y su saldo, para revisar que todo cuadre. Estado de Resultados: cuánto ganó o perdió la empresa en un rango de fechas (ingresos menos gastos). Balance General: qué tiene, qué debe y qué es del dueño la empresa en un momento dado. Libro Mayor: el detalle de todos los movimientos de una sola cuenta.';

const { from: defaultFrom, to: defaultTo } = currentMonthRange();

export default function ReportsPage() {
  const [reportType, setReportType] = useState('trial-balance');
  const [asOfDate, setAsOfDate] = useState(toIsoDate(new Date()));
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');

  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    accountsApi
      .list({ isActive: true })
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  async function generate() {
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      let data;
      if (reportType === 'trial-balance') data = await accountingReportsApi.trialBalance(asOfDate);
      if (reportType === 'income-statement') data = await accountingReportsApi.incomeStatement(from, to);
      if (reportType === 'balance-sheet') data = await accountingReportsApi.balanceSheet(asOfDate);
      if (reportType === 'general-ledger') {
        if (!accountId) {
          setError('Selecciona una cuenta.');
          setIsLoading(false);
          return;
        }
        data = await accountingReportsApi.generalLedger(accountId, from, to);
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el reporte.');
    } finally {
      setIsLoading(false);
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
            <span className="field-label">
              Tipo de reporte
              <HelpTooltip text={REPORT_HELP} />
            </span>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value);
                setResult(null);
              }}
            >
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          {(reportType === 'trial-balance' || reportType === 'balance-sheet') && (
            <label className="field">
              <span>Al día</span>
              <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            </label>
          )}

          {(reportType === 'income-statement' || reportType === 'general-ledger') && (
            <>
              <label className="field">
                <span>Desde</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          )}

          {reportType === 'general-ledger' && (
            <label className="field">
              <span>Cuenta</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Selecciona una cuenta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={isLoading}>
            {isLoading ? 'Generando…' : 'Generar'}
          </button>
        </div>

        {error && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{error}</p>}
      </div>

      {result && reportType === 'trial-balance' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Balance de Comprobación al {formatDate(new Date(`${asOfDate}T00:00:00`))}</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cuenta</th>
                <th className="num">Débito</th>
                <th className="num">Crédito</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.accountId}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td className="num">{formatCurrency(row.debit)}</td>
                  <td className="num">{formatCurrency(row.credit)}</td>
                  <td className="num">{formatCurrency(row.balance)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}><strong>Totales</strong></td>
                <td className="num"><strong>{formatCurrency(result.totalDebit)}</strong></td>
                <td className="num"><strong>{formatCurrency(result.totalCredit)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {result && reportType === 'income-statement' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Estado de Resultados</h2>
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
                    <td>{row.code} · {row.name}</td>
                    <td className="num">{formatCurrency(row.amount)}</td>
                  </tr>
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
                <td><strong>Utilidad neta</strong></td>
                <td className="num"><strong>{formatCurrency(result.netIncome)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {result && reportType === 'balance-sheet' && (
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
                    <td>{row.code} · {row.name}</td>
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
                <td>Resultado del ejercicio</td>
                <td className="num">{formatCurrency(result.netIncomeToDate)}</td>
              </tr>
              <tr>
                <td><strong>Total Pasivo + Patrimonio</strong></td>
                <td className="num"><strong>{formatCurrency(result.totalLiabilitiesAndEquity)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {result && reportType === 'general-ledger' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Libro Mayor — {result.account.code} · {result.account.name}</h2>
          </div>
          <p className="text-muted" style={{ marginBottom: 12 }}>
            Saldo inicial: {formatCurrency(result.openingBalance)} · Saldo final: {formatCurrency(result.closingBalance)}
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>N.º</th>
                <th>Descripción</th>
                <th className="num">Débito</th>
                <th className="num">Crédito</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {result.movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="data-table-empty">Sin movimientos en el rango indicado.</td>
                </tr>
              )}
              {result.movements.map((m, i) => (
                <tr key={i}>
                  <td>{formatDate(new Date(m.date))}</td>
                  <td>{m.entryNumber}</td>
                  <td>{m.description}</td>
                  <td className="num">{formatCurrency(m.debit)}</td>
                  <td className="num">{formatCurrency(m.credit)}</td>
                  <td className="num">{formatCurrency(m.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
