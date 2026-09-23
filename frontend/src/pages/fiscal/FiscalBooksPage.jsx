import { useCallback, useEffect, useState } from 'react';
import { fiscalBooksApi } from '../../api/fiscal';
import { periodsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate, currentMonthRange } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const BOOK_LABELS = { sales: 'Libro de ventas', purchases: 'Libro de compras', withholdings: 'Resumen de retenciones', reconciliation: 'Conciliación' };

export default function FiscalBooksPage() {
  const [mode, setMode] = useState('sales');
  const [range, setRange] = useState(currentMonthRange());

  const [book, setBook] = useState(null);
  const [withholdings, setWithholdings] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [reconciliation, setReconciliation] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    periodsApi.list().then(setPeriods).catch(() => setPeriods([]));
  }, []);

  const loadBook = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    setBook(null);
    try {
      const data = mode === 'sales' ? await fiscalBooksApi.salesBook(range.from, range.to) : await fiscalBooksApi.purchasesBook(range.from, range.to);
      setBook(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el libro fiscal.');
    } finally {
      setIsLoading(false);
    }
  }, [mode, range]);

  const loadWithholdings = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    setWithholdings(null);
    try {
      setWithholdings(await fiscalBooksApi.withholdingsSummary(range.from, range.to));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen de retenciones.');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (mode === 'sales' || mode === 'purchases') loadBook();
    if (mode === 'withholdings') loadWithholdings();
  }, [mode, loadBook, loadWithholdings]);

  async function handleReconcile() {
    if (!periodId) return;
    setIsLoading(true);
    setLoadError('');
    setReconciliation(null);
    try {
      setReconciliation(await fiscalBooksApi.reconcilePeriod(periodId));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo conciliar el periodo.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="module-tabs" style={{ marginBottom: 16 }}>
          {Object.entries(BOOK_LABELS).map(([key, label]) => (
            <button key={key} type="button" className={`module-tab${mode === key ? ' is-active' : ''}`} onClick={() => setMode(key)}>
              {label}
            </button>
          ))}
        </div>

        {mode !== 'reconciliation' && (
          <div className="btn-row" style={{ marginBottom: 16, alignItems: 'center' }}>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span>Desde</span>
              <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span>Hasta</span>
              <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </label>
          </div>
        )}

        {mode === 'reconciliation' && (
          <div className="btn-row" style={{ marginBottom: 16, alignItems: 'center' }}>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span className="field-label">
                Periodo contable
                <HelpTooltip text="Compara, para cada tasa de impuesto con cuenta contable configurada, lo que registró Fiscal contra el movimiento real de esa cuenta en el mayor contable del mismo periodo — para detectar si algo se contabilizó por fuera de este módulo." />
              </span>
              <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                <option value="">Selecciona un periodo</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary btn-small" onClick={handleReconcile} disabled={!periodId}>
              Conciliar
            </button>
          </div>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}

        {!isLoading && !loadError && (mode === 'sales' || mode === 'purchases') && book && (
          <>
            {book.lines.length === 0 && <EmptyState icon="▤" message="No hay transacciones fiscales en este rango de fechas." />}
            {book.lines.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>N.º documento</th>
                    <th>Contraparte</th>
                    <th className="num">Base</th>
                    <th className="num">Impuesto</th>
                    <th className="num">Retención</th>
                  </tr>
                </thead>
                <tbody>
                  {book.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{formatDate(new Date(line.date))}</td>
                      <td>{line.documentNumber || '—'}</td>
                      <td>{line.counterpartyName}</td>
                      <td className="num">{formatCurrency(line.taxBase)}</td>
                      <td className="num">{formatCurrency(line.taxAmount)}</td>
                      <td className="num">{formatCurrency(line.withholdingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <strong>Total</strong>
                    </td>
                    <td className="num">
                      <strong>{formatCurrency(book.totalBase)}</strong>
                    </td>
                    <td className="num">
                      <strong>{formatCurrency(book.totalTax)}</strong>
                    </td>
                    <td className="num">
                      <strong>{formatCurrency(book.totalWithholding)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </>
        )}

        {!isLoading && !loadError && mode === 'withholdings' && withholdings && (
          <>
            {withholdings.rates.length === 0 && <EmptyState icon="▤" message="No hay retenciones en este rango de fechas." />}
            {withholdings.rates.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tasa</th>
                    <th className="num">Cantidad de transacciones</th>
                    <th className="num">Total retenido</th>
                  </tr>
                </thead>
                <tbody>
                  {withholdings.rates.map((r) => (
                    <tr key={r.rateId || 'sin-tasa'}>
                      <td>{r.rateName}</td>
                      <td className="num">{r.count}</td>
                      <td className="num">{formatCurrency(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {!isLoading && !loadError && mode === 'reconciliation' && reconciliation && (
          <>
            {reconciliation.results.length === 0 && (
              <EmptyState icon="▤" message="Ninguna tasa tiene una cuenta contable configurada para conciliar." />
            )}
            {reconciliation.results.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tasa</th>
                    <th className="num">Según Fiscal</th>
                    <th className="num">Según el mayor contable</th>
                    <th className="num">Diferencia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation.results.map((r) => (
                    <tr key={r.taxRateId}>
                      <td>{r.taxRateName}</td>
                      <td className="num">{formatCurrency(r.fiscalAmount)}</td>
                      <td className="num">{formatCurrency(r.ledgerAmount)}</td>
                      <td className="num">{formatCurrency(r.difference)}</td>
                      <td>
                        <StatusSeal tone={r.matches ? 'positive' : 'negative'} label={r.matches ? 'Cuadra' : 'Con diferencia'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
