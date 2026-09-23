import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { financialStatementsApi } from '../../api/reports';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import Breadcrumb from '../../core/ui/Breadcrumb';
import DataTable from '../../core/ui/DataTable';

const TYPE_LABELS = { INCOME: 'Ingresos', EXPENSE: 'Egresos', ASSET: 'Activos', LIABILITY: 'Pasivos', EQUITY: 'Patrimonio' };

// Pantalla de drill-down: llega siempre desde un clic en un gráfico (el
// Panel principal, por ahora) con el filtro ya decidido en
// `location.state` — nunca se navega acá con un formulario propio, por
// eso si falta el estado (ej. alguien entra por URL directa) se muestra
// una invitación a volver, en vez de un formulario de filtros duplicado.
export default function TransactionsByTypePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { type, from, to, monthLabel } = location.state || {};

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!type) return;
    let isMounted = true;
    setIsLoading(true);
    setError('');
    financialStatementsApi
      .transactionsByType(type, from, to)
      .then((data) => {
        if (isMounted) setRows(data);
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las transacciones.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [type, from, to]);

  const columns = useMemo(
    () => [
      { key: 'date', label: 'Fecha', value: (r) => formatDate(new Date(r.date)), defaultWidth: 110 },
      { key: 'entryNumber', label: 'N.º de asiento', value: (r) => r.entryNumber, defaultWidth: 110 },
      { key: 'accountCode', label: 'Cuenta', value: (r) => `${r.accountCode} · ${r.accountName}`, defaultWidth: 220 },
      { key: 'description', label: 'Descripción', value: (r) => r.description || '—', defaultWidth: 220 },
      { key: 'debit', label: 'Débito', align: 'num', value: (r) => formatCurrency(r.debit), defaultWidth: 110 },
      { key: 'credit', label: 'Crédito', align: 'num', value: (r) => formatCurrency(r.credit), defaultWidth: 110 },
    ],
    []
  );

  if (!type) {
    return (
      <div className="page">
        <div className="panel">
          <p className="text-muted">
            Esta pantalla muestra las transacciones detrás de un número del Panel principal — entra haciendo clic en una barra del
            gráfico de ingresos y egresos.
          </p>
          <button type="button" className="btn btn-small" onClick={() => navigate('/')}>
            Volver al Panel principal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb
        items={[
          { label: 'Panel principal', to: '/' },
          { label: TYPE_LABELS[type] || type },
          { label: monthLabel || 'Detalle' },
        ]}
      />
      <div className="panel">
        <div className="panel-header">
          <h2>
            {TYPE_LABELS[type] || type} — {monthLabel}
          </h2>
        </div>
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && error && <p className="alert-box alert-box-error">{error}</p>}
        {!isLoading && !error && (
          <DataTable
            tableKey="reports-transactions-by-type"
            columns={columns}
            data={rows}
            rowKey={(r) => `${r.entryId}-${r.accountId}`}
            emptyIcon="▤"
            emptyMessage="No hay transacciones registradas en este periodo."
            exportTitle={`${TYPE_LABELS[type] || type} - ${monthLabel || ''}`}
          />
        )}
      </div>
    </div>
  );
}
