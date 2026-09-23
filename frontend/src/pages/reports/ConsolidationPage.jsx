import { useState } from 'react';
import { consolidationApi } from '../../api/reports';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';

export default function ConsolidationPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [asOfDate, setAsOfDate] = useState(toIsoDate(new Date()));
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await consolidationApi.trialBalance(asOfDate));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar la consolidación.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="panel">
          <EmptyState icon="⊘" message="Solo un administrador puede ver la consolidación de empresas del grupo." />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Consolidación de empresas del grupo
            <HelpTooltip text="Suma el balance de comprobación de la empresa matriz y sus subsidiarias, excluyendo automáticamente las cuentas marcadas como “inter-compañía” (por ejemplo, una venta de la matriz a su propia subsidiaria) para no duplicar esos montos." />
          </h2>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Al día</span>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </label>
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

      {result && (
        <>
          <div className="panel">
            <div className="panel-header">
              <h2>Balance de Comprobación Consolidado</h2>
              <span className="text-muted">
                Empresas incluidas: {result.companiesIncluded.map((c) => c.name).join(', ')}
              </span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cuenta</th>
                  <th className="num">Saldo consolidado</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.code}>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td className="num">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2 className="field-label">
                Eliminaciones inter-compañía
                <HelpTooltip text="Movimientos entre empresas del mismo grupo (por ejemplo, una venta de la matriz a su subsidiaria) que se excluyen del total consolidado, para no contar dos veces el mismo dinero." />
              </h2>
              <span className="text-muted">Total excluido: {formatCurrency(result.intercompanyEliminated)}</span>
            </div>
            {result.eliminatedDetail.length === 0 && (
              <EmptyState icon="⊘" message="No hay cuentas inter-compañía excluidas a esta fecha." />
            )}
            {result.eliminatedDetail.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Código</th>
                    <th>Cuenta</th>
                    <th className="num">Saldo excluido</th>
                  </tr>
                </thead>
                <tbody>
                  {result.eliminatedDetail.map((row, i) => (
                    <tr key={i}>
                      <td>{row.companyName}</td>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td className="num">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!result && !isLoading && !error && (
        <div className="panel">
          <EmptyState icon="▤" message="Elige una fecha y genera para ver la consolidación." />
        </div>
      )}
    </div>
  );
}
