import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cashFlowApi } from '../../api/reports';
import { ApiError } from '../../api/client';
import { formatCurrency, currentMonthRange } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import DateRangeSelector from '../../core/ui/DateRangeSelector';
import QuickExportButtons from '../../core/ui/QuickExportButtons';
import DocumentActionsMenu from '../../core/ui/DocumentActionsMenu';
import { reportExportApi } from '../../api/reports';
import { EMAIL_TEMPLATES } from '../../utils/emailTemplates';

const { from: defaultFrom, to: defaultTo } = currentMonthRange();

export default function CashFlowPage() {
  const { user } = useAuth();
  const canSchedule = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const [range, setRange] = useState({ from: defaultFrom, to: defaultTo });
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await cashFlowApi.get(range.from, range.to));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el flujo de efectivo.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Flujo de Efectivo
            <HelpTooltip text="Muestra de dónde vino y a dónde fue el efectivo de la empresa en el periodo: operación (el negocio del día a día), inversión (compra/venta de activos) y financiamiento (deuda y capital)." />
          </h2>
        </div>
        <DateRangeSelector value={range} onChange={setRange} />
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

      {result && result.staleCashAccounts?.length > 0 && (
        <p className="alert-box alert-box-warning" style={{ marginBottom: 16 }}>
          ⚠ Este reporte depende de {result.staleCashAccounts.length === 1 ? 'una cuenta bancaria' : `${result.staleCashAccounts.length} cuentas bancarias`} sin sincronizar hace más de 48 horas
          ({result.staleCashAccounts.map((a) => a.name).join(', ')}) — el saldo de efectivo mostrado puede no reflejar movimientos recientes.{' '}
          <Link to="/tesoreria/cuentas">Ver estado de sincronización</Link>
        </p>
      )}

      {result && (
        <>
          <div className="btn-row" style={{ marginBottom: 16 }}>
            <QuickExportButtons reportType="cash-flow" params={{ from: range.from, to: range.to }} canSchedule={canSchedule} />
            <DocumentActionsMenu
              shareUrl={window.location.href}
              exportOptions={[
                { format: 'pdf', label: 'PDF' },
                { format: 'excel', label: 'Excel' },
                { format: 'csv', label: 'CSV' },
              ]}
              onExport={(format) => reportExportApi.download('cash-flow', format, { from: range.from, to: range.to })}
              emailTemplates={EMAIL_TEMPLATES.report}
              emailContext={{ reportName: 'Flujo de Efectivo', period: `${range.from} a ${range.to}` }}
            />
          </div>
          <div className="panel">
            <div className="panel-header">
              <h2 className="field-label">
                Resumen (método indirecto)
                <HelpTooltip text="El cambio de efectivo se cuadra siempre contra el cambio real de las cuentas bancarias — si el sello dice “Cuadra”, el cálculo es correcto." />
              </h2>
              <StatusSeal tone={result.indirect.reconciles ? 'positive' : 'negative'} label={result.indirect.reconciles ? 'Cuadra' : 'No cuadra'} />
            </div>
            <table className="data-table">
              <tbody>
                <tr>
                  <td>Utilidad neta del periodo</td>
                  <td className="num">{formatCurrency(result.indirect.operating.netIncome)}</td>
                </tr>
                <tr>
                  <td>+ Depreciación</td>
                  <td className="num">{formatCurrency(result.indirect.operating.depreciationAddback)}</td>
                </tr>
                <tr>
                  <td>± Cambio en otros activos/pasivos operativos</td>
                  <td className="num">
                    {formatCurrency(
                      Number(result.indirect.operating.changeInOtherOperatingAssets) +
                        Number(result.indirect.operating.changeInOtherOperatingLiabilities)
                    )}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Efectivo de la operación</strong>
                  </td>
                  <td className="num">
                    <strong>{formatCurrency(result.indirect.operating.total)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Efectivo de inversión (compra/venta de activos)</td>
                  <td className="num">{formatCurrency(result.indirect.investing.total)}</td>
                </tr>
                <tr>
                  <td>Efectivo de financiamiento (deuda y capital)</td>
                  <td className="num">{formatCurrency(result.indirect.financing.total)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Cambio neto en efectivo</strong>
                  </td>
                  <td className="num">
                    <strong>{formatCurrency(result.indirect.netChangeInCash)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {['operating', 'investing', 'financing'].map((category) => {
            const rows = result.direct[category];
            const labels = { operating: 'Detalle de Operación', investing: 'Detalle de Inversión', financing: 'Detalle de Financiamiento' };
            return (
              <div className="panel" key={category}>
                <div className="panel-header">
                  <h2>{labels[category]}</h2>
                </div>
                {rows.length === 0 && <EmptyState icon="▤" message="Sin movimientos de efectivo en esta categoría." />}
                {rows.length > 0 && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cuenta</th>
                        <th className="num">Efecto neto en efectivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.accountCode || row.accountName}>
                          <td>
                            {row.accountCode ? `${row.accountCode} · ` : ''}
                            {row.accountName}
                          </td>
                          <td className="num">{formatCurrency(row.netCashEffect)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </>
      )}

      {!result && !isLoading && !error && (
        <div className="panel">
          <EmptyState icon="▤" message="Elige un rango de fechas y genera para ver el flujo de efectivo." />
        </div>
      )}
    </div>
  );
}
