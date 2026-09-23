import { useCallback, useEffect, useState } from 'react';
import { taxRatesApi } from '../../api/fiscal';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatDate, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const TAX_TYPE_LABELS = { VAT: 'Impuesto (IVA)', WITHHOLDING: 'Retención', OTHER: 'Otro' };
const APPLIES_TO_LABELS = { SALE: 'Solo ventas', PURCHASE: 'Solo compras', BOTH: 'Ventas y compras' };

export default function TaxRatesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';

  const [jurisdictions, setJurisdictions] = useState([]);
  const [rates, setRates] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isJurisdictionFormOpen, setIsJurisdictionFormOpen] = useState(false);
  const [jurisdictionForm, setJurisdictionForm] = useState({ code: '', name: '' });
  const [jurisdictionError, setJurisdictionError] = useState('');

  const [isRateFormOpen, setIsRateFormOpen] = useState(false);
  const [rateForm, setRateForm] = useState({
    jurisdictionId: '',
    type: 'VAT',
    code: '',
    name: '',
    rate: '',
    appliesTo: 'BOTH',
    validFrom: toIsoDate(new Date()),
    validTo: '',
    glAccountId: '',
  });
  const [rateError, setRateError] = useState('');
  const [closingId, setClosingId] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [closeError, setCloseError] = useState({});

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [jurisdictionsData, ratesData, accountsData] = await Promise.all([
        taxRatesApi.listJurisdictions(),
        taxRatesApi.listRates(),
        accountsApi.list({ isActive: true }),
      ]);
      setJurisdictions(jurisdictionsData);
      setRates(ratesData);
      setAccounts(accountsData.filter((a) => a.isPostable));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los impuestos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function jurisdictionName(id) {
    return jurisdictions.find((j) => j.id === id)?.name || '—';
  }

  async function handleCreateJurisdiction(event) {
    event.preventDefault();
    setJurisdictionError('');
    try {
      await taxRatesApi.createJurisdiction(jurisdictionForm);
      setJurisdictionForm({ code: '', name: '' });
      setIsJurisdictionFormOpen(false);
      await loadAll();
    } catch (err) {
      setJurisdictionError(err instanceof ApiError ? err.message : 'No se pudo crear la jurisdicción.');
    }
  }

  async function handleCreateRate(event) {
    event.preventDefault();
    setRateError('');
    try {
      await taxRatesApi.createRate({
        ...rateForm,
        rate: Number(rateForm.rate),
        validTo: rateForm.validTo || undefined,
        glAccountId: rateForm.glAccountId || undefined,
      });
      setRateForm({
        jurisdictionId: '',
        type: 'VAT',
        code: '',
        name: '',
        rate: '',
        appliesTo: 'BOTH',
        validFrom: toIsoDate(new Date()),
        validTo: '',
        glAccountId: '',
      });
      setIsRateFormOpen(false);
      await loadAll();
    } catch (err) {
      setRateError(err instanceof ApiError ? err.message : 'No se pudo crear la tasa.');
    }
  }

  async function handleCloseRate(rate) {
    setCloseError((prev) => ({ ...prev, [rate.id]: '' }));
    if (!closeDate) {
      setCloseError((prev) => ({ ...prev, [rate.id]: 'Indica la fecha de cierre.' }));
      return;
    }
    try {
      await taxRatesApi.closeRate(rate.id, closeDate);
      setClosingId('');
      setCloseDate('');
      await loadAll();
    } catch (err) {
      setCloseError((prev) => ({ ...prev, [rate.id]: err instanceof ApiError ? err.message : 'No se pudo cerrar la tasa.' }));
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Jurisdicciones
            <HelpTooltip text="El país, estado o región cuyas reglas de impuestos vas a usar. Cada tasa de impuesto pertenece siempre a una jurisdicción." />
          </h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsJurisdictionFormOpen((v) => !v)}>
              {isJurisdictionFormOpen ? 'Cancelar' : '+ Nueva jurisdicción'}
            </button>
          )}
        </div>
        {isJurisdictionFormOpen && (
          <form onSubmit={handleCreateJurisdiction} className="form-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>Código</span>
              <input value={jurisdictionForm.code} onChange={(e) => setJurisdictionForm({ ...jurisdictionForm, code: e.target.value })} required />
            </label>
            <label className="field">
              <span>Nombre</span>
              <input value={jurisdictionForm.name} onChange={(e) => setJurisdictionForm({ ...jurisdictionForm, name: e.target.value })} required />
            </label>
            {jurisdictionError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {jurisdictionError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary btn-small">
                Crear jurisdicción
              </button>
            </div>
          </form>
        )}
        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && jurisdictions.length === 0 && (
          <EmptyState icon="◇" message="Todavía no hay jurisdicciones creadas." />
        )}
        {!isLoading && !loadError && jurisdictions.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
              </tr>
            </thead>
            <tbody>
              {jurisdictions.map((j) => (
                <tr key={j.id}>
                  <td>{j.code}</td>
                  <td>{j.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Tasas de impuesto y retención
            <HelpTooltip text="El porcentaje que se cobra o se retiene en cada venta o compra. Una tasa nunca se edita una vez usada: se cierra con una fecha y se crea una nueva si el porcentaje cambia." />
          </h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsRateFormOpen((v) => !v)}>
              {isRateFormOpen ? 'Cancelar' : '+ Nueva tasa'}
            </button>
          )}
        </div>

        {isRateFormOpen && (
          <form onSubmit={handleCreateRate} className="form-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>Jurisdicción</span>
              <select value={rateForm.jurisdictionId} onChange={(e) => setRateForm({ ...rateForm, jurisdictionId: e.target.value })} required>
                <option value="">Selecciona una jurisdicción</option>
                {jurisdictions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tipo</span>
              <select value={rateForm.type} onChange={(e) => setRateForm({ ...rateForm, type: e.target.value })}>
                <option value="VAT">Impuesto (IVA)</option>
                <option value="WITHHOLDING">Retención</option>
                <option value="OTHER">Otro</option>
              </select>
            </label>
            <label className="field">
              <span>Código</span>
              <input value={rateForm.code} onChange={(e) => setRateForm({ ...rateForm, code: e.target.value })} placeholder="IVA_19" required />
            </label>
            <label className="field">
              <span>Nombre</span>
              <input value={rateForm.name} onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Porcentaje (%)</span>
              <input type="number" step="0.0001" min="0" value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} required />
            </label>
            <label className="field">
              <span>Aplica a</span>
              <select value={rateForm.appliesTo} onChange={(e) => setRateForm({ ...rateForm, appliesTo: e.target.value })}>
                <option value="BOTH">Ventas y compras</option>
                <option value="SALE">Solo ventas</option>
                <option value="PURCHASE">Solo compras</option>
              </select>
            </label>
            <label className="field">
              <span>Vigente desde</span>
              <input type="date" value={rateForm.validFrom} onChange={(e) => setRateForm({ ...rateForm, validFrom: e.target.value })} required />
            </label>
            <label className="field">
              <span>Vigente hasta (opcional)</span>
              <input type="date" value={rateForm.validTo} onChange={(e) => setRateForm({ ...rateForm, validTo: e.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">
                Cuenta contable
                <HelpTooltip text="La cuenta donde se registra este impuesto o retención por defecto cada vez que se usa (por ejemplo, “IVA por Pagar”). Es opcional: se puede indicar otra cuenta puntualmente al registrar una transacción." />
              </span>
              <select value={rateForm.glAccountId} onChange={(e) => setRateForm({ ...rateForm, glAccountId: e.target.value })}>
                <option value="">Sin configurar</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            {rateError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {rateError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary btn-small">
                Crear tasa
              </button>
            </div>
          </form>
        )}

        {!isLoading && !loadError && rates.length === 0 && <EmptyState icon="%" message="Todavía no hay tasas de impuesto creadas." />}
        {!isLoading && !loadError && rates.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Jurisdicción</th>
                <th>Tipo</th>
                <th>Nombre</th>
                <th className="num">Porcentaje</th>
                <th>Aplica a</th>
                <th>Vigencia</th>
                <th>Estado</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                const isOpenEnded = !r.validTo || new Date(r.validTo) >= new Date();
                return (
                  <tr key={r.id}>
                    <td>{jurisdictionName(r.jurisdictionId)}</td>
                    <td>{TAX_TYPE_LABELS[r.type] || r.type}</td>
                    <td>{r.name}</td>
                    <td className="num">{Number(r.rate).toFixed(2)}%</td>
                    <td>{APPLIES_TO_LABELS[r.appliesTo] || r.appliesTo}</td>
                    <td>
                      {formatDate(new Date(r.validFrom))} — {r.validTo ? formatDate(new Date(r.validTo)) : 'sigue vigente'}
                    </td>
                    <td>
                      <StatusSeal tone={isOpenEnded ? 'positive' : 'negative'} label={isOpenEnded ? 'Vigente' : 'Cerrada'} />
                    </td>
                    {canManage && (
                      <td>
                        {isOpenEnded &&
                          (closingId === r.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
                              <button type="button" className="btn btn-small" onClick={() => handleCloseRate(r)}>
                                Confirmar
                              </button>
                              <button type="button" className="btn btn-small" onClick={() => setClosingId('')}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="btn btn-small" onClick={() => setClosingId(r.id)}>
                              Cerrar vigencia
                            </button>
                          ))}
                        {closeError[r.id] && <p className="alert-box alert-box-error" style={{ marginTop: 4 }}>{closeError[r.id]}</p>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
