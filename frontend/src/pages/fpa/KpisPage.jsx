import { useEffect, useState } from 'react';
import { kpisApi } from '../../api/fpa';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import { formatCurrency, currentMonthRange } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';

const { from: defaultFrom, to: defaultTo } = currentMonthRange();

export default function KpisPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [ebitda, setEbitda] = useState(null);
  const [burnRunway, setBurnRunway] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statErrors, setStatErrors] = useState({});

  const [definitions, setDefinitions] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', formula: '' });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [evaluations, setEvaluations] = useState({});
  const [evalErrors, setEvalErrors] = useState({});

  const [compareId, setCompareId] = useState('');
  const [fromA, setFromA] = useState(defaultFrom);
  const [toA, setToA] = useState(defaultTo);
  const [fromB, setFromB] = useState(defaultFrom);
  const [toB, setToB] = useState(defaultTo);
  const [compareResult, setCompareResult] = useState(null);
  const [compareError, setCompareError] = useState('');

  function loadStats(fromDate, toDate) {
    setIsLoading(true);
    Promise.allSettled([kpisApi.ebitda(fromDate, toDate), kpisApi.burnRateAndRunway(fromDate, toDate)]).then(([e, b]) => {
      setEbitda(e.status === 'fulfilled' ? e.value : null);
      setBurnRunway(b.status === 'fulfilled' ? b.value : null);
      setStatErrors({ ebitda: e.status === 'rejected', burnRunway: b.status === 'rejected' });
      setIsLoading(false);
    });
  }

  function loadDefinitions() {
    kpisApi
      .listDefinitions()
      .then(setDefinitions)
      .catch(() => setDefinitions([]));
  }

  useEffect(() => {
    loadStats(from, to);
    loadDefinitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await kpisApi.createDefinition(form);
      setForm({ name: '', description: '', formula: '' });
      setIsFormOpen(false);
      loadDefinitions();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el KPI.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEvaluate(def) {
    setEvalErrors((prev) => ({ ...prev, [def.id]: '' }));
    try {
      const data = await kpisApi.evaluate(def.id, from, to);
      setEvaluations((prev) => ({ ...prev, [def.id]: data.value }));
    } catch (err) {
      setEvalErrors((prev) => ({ ...prev, [def.id]: err instanceof ApiError ? err.message : 'No se pudo evaluar.' }));
    }
  }

  async function handleCompare() {
    setCompareError('');
    setCompareResult(null);
    if (!compareId) {
      setCompareError('Selecciona un KPI para comparar.');
      return;
    }
    try {
      const data = await kpisApi.compare(compareId, fromA, toA, fromB, toB);
      setCompareResult(data);
    } catch (err) {
      setCompareError(err instanceof ApiError ? err.message : 'No se pudo comparar el KPI.');
    }
  }

  const isBurning = burnRunway && Number(burnRunway.monthlyBurnRate) > 0;

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Tablero de KPIs</h2>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <span>Desde</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <span>Hasta</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary btn-small" onClick={() => loadStats(from, to)}>
              Recalcular
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          <StatCard
            label="EBITDA del periodo"
            value={ebitda ? formatCurrency(ebitda.ebitda) : '—'}
            hint={ebitda ? `Utilidad neta: ${formatCurrency(ebitda.netIncome)}` : null}
            isLoading={isLoading}
            error={statErrors.ebitda}
          />
          <StatCard
            label="Burn rate mensual"
            value={burnRunway ? formatCurrency(burnRunway.monthlyBurnRate) : '—'}
            hint={isBurning ? 'La operación está consumiendo caja este periodo.' : 'La operación no está consumiendo caja.'}
            tone={isBurning ? 'negative' : 'positive'}
            isLoading={isLoading}
            error={statErrors.burnRunway}
          />
          <StatCard
            label="Runway"
            value={burnRunway?.runwayMonths ? `${burnRunway.runwayMonths} meses` : 'No aplica'}
            hint="Meses de caja disponibles al ritmo actual de consumo."
            tone={burnRunway?.runwayMonths ? 'warning' : 'positive'}
            isLoading={isLoading}
            error={statErrors.burnRunway}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            KPIs personalizados
            <HelpTooltip text="Puedes definir tus propias fórmulas usando el código de cualquier cuenta de ingreso o gasto entre corchetes, ej: ([4135] - [5310]) / [4135] para un margen bruto." />
          </h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nuevo KPI'}
            </button>
          )}
        </div>

        {canManage && isFormOpen && (
          <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>Nombre</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Margen Bruto" required />
            </label>
            <label className="field">
              <span>Descripción (opcional)</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">
                Fórmula
                <HelpTooltip text="Usa el código de cuenta entre corchetes, ej: ([4135] - [5310]) / [4135]. Soporta +, -, *, /, paréntesis." />
              </span>
              <input value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })} placeholder="([4135] - [5310]) / [4135]" required />
            </label>
            {formError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear KPI'}
              </button>
            </div>
          </form>
        )}

        {definitions.length === 0 && <EmptyState icon="●" message="Todavía no creaste ningún KPI personalizado." />}
        {definitions.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Fórmula</th>
                <th className="num">Valor en el rango de arriba</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((def) => (
                <tr key={def.id}>
                  <td>{def.name}</td>
                  <td>
                    <code style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{def.formula}</code>
                  </td>
                  <td className="num">
                    {evaluations[def.id] !== undefined ? evaluations[def.id] : '—'}
                    {evalErrors[def.id] && <div style={{ color: 'var(--color-negative)', fontSize: 12 }}>{evalErrors[def.id]}</div>}
                  </td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => handleEvaluate(def)}>
                      Evaluar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Comparar un KPI entre dos periodos</h2>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>KPI</span>
            <select value={compareId} onChange={(e) => setCompareId(e.target.value)}>
              <option value="">Selecciona un KPI</option>
              {definitions.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name}
                </option>
              ))}
            </select>
          </label>
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
        </div>
        {compareError && (
          <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
            {compareError}
          </p>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={handleCompare}>
            Comparar
          </button>
        </div>

        {compareResult && (
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Periodo A</th>
                <th>Periodo B</th>
                <th className="num">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="num">{compareResult.periodA.value}</td>
                <td className="num">{compareResult.periodB.value}</td>
                <td className="num">{compareResult.delta}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
