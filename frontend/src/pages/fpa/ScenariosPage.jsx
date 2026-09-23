import { useEffect, useState } from 'react';
import { scenariosApi } from '../../api/fpa';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, currentMonthRange } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';

const ADJUSTMENT_TYPES = [
  { value: 'RECURRING_EXPENSE', label: 'Gasto recurrente nuevo' },
  { value: 'NEW_HIRE', label: 'Nueva contratación' },
  { value: 'SALES_VARIATION', label: 'Variación de ventas (%)' },
];

function emptyAdjustment() {
  return { type: 'RECURRING_EXPENSE', monthlyAmount: '', monthlyCost: '', percentage: '' };
}

function toApiAdjustment(a) {
  if (a.type === 'RECURRING_EXPENSE') return { type: a.type, monthlyAmount: Number(a.monthlyAmount) || 0 };
  if (a.type === 'NEW_HIRE') return { type: a.type, monthlyCost: Number(a.monthlyCost) || 0 };
  return { type: a.type, percentage: Number(a.percentage) || 0 };
}

const { from: defaultFrom, to: defaultTo } = currentMonthRange();

export default function ScenariosPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [baselineFrom, setBaselineFrom] = useState(defaultFrom);
  const [baselineTo, setBaselineTo] = useState(defaultTo);
  const [projectionMonths, setProjectionMonths] = useState(6);
  const [adjustments, setAdjustments] = useState([emptyAdjustment()]);

  const [result, setResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState('');

  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [savedScenarios, setSavedScenarios] = useState([]);

  function loadSaved() {
    scenariosApi
      .list()
      .then(setSavedScenarios)
      .catch(() => setSavedScenarios([]));
  }

  useEffect(() => {
    loadSaved();
  }, []);

  function updateAdjustment(index, changes) {
    setAdjustments((prev) => prev.map((a, i) => (i === index ? { ...a, ...changes } : a)));
  }

  function addAdjustment() {
    setAdjustments((prev) => [...prev, emptyAdjustment()]);
  }

  function removeAdjustment(index) {
    setAdjustments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSimulate(event) {
    event.preventDefault();
    setSimulateError('');
    setSaveSuccess('');
    setIsSimulating(true);
    try {
      const data = await scenariosApi.simulate({
        baselineFrom,
        baselineTo,
        projectionMonths: Number(projectionMonths),
        adjustments: adjustments.map(toApiAdjustment),
      });
      setResult(data);
    } catch (err) {
      setSimulateError(err instanceof ApiError ? err.message : 'No se pudo simular el escenario.');
    } finally {
      setIsSimulating(false);
    }
  }

  async function handleSaveScenario() {
    if (!result) return;
    setSaveError('');
    setSaveSuccess('');
    if (!scenarioName.trim()) {
      setSaveError('Escribe un nombre para guardar el escenario.');
      return;
    }
    setIsSaving(true);
    try {
      await scenariosApi.save({
        name: scenarioName,
        description: scenarioDescription || undefined,
        parameters: { baselineFrom, baselineTo, projectionMonths: Number(projectionMonths), adjustments: adjustments.map(toApiAdjustment) },
        projectedResult: result,
      });
      setScenarioName('');
      setScenarioDescription('');
      setSaveSuccess('Escenario guardado.');
      loadSaved();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'No se pudo guardar el escenario.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Simulador de Escenarios (What-If)
            <HelpTooltip text="Simula el impacto de un cambio hipotético (un gasto nuevo, una contratación, una variación de ventas) sobre la utilidad y sobre la caja proyectada — sin cambiar nada real en el sistema. Solo se guarda algo si tú decides guardar el resultado como referencia." />
          </h2>
        </div>
        <form onSubmit={handleSimulate}>
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>Línea base — desde</span>
              <input type="date" value={baselineFrom} onChange={(e) => setBaselineFrom(e.target.value)} required />
            </label>
            <label className="field">
              <span>Línea base — hasta</span>
              <input type="date" value={baselineTo} onChange={(e) => setBaselineTo(e.target.value)} required />
            </label>
            <label className="field">
              <span className="field-label">
                Meses a proyectar
                <HelpTooltip text="Cuántos meses hacia adelante se proyecta el impacto del escenario, tomando como referencia el promedio mensual del rango de línea base." />
              </span>
              <input
                type="number"
                min={1}
                max={60}
                value={projectionMonths}
                onChange={(e) => setProjectionMonths(e.target.value)}
                required
              />
            </label>
          </div>

          <p className="section-title">Ajustes del escenario</p>
          {adjustments.map((a, index) => (
            <div key={index} className="btn-row" style={{ alignItems: 'center', marginBottom: 8 }}>
              <select value={a.type} onChange={(e) => updateAdjustment(index, { type: e.target.value })}>
                {ADJUSTMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {a.type === 'RECURRING_EXPENSE' && (
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monto mensual"
                  value={a.monthlyAmount}
                  onChange={(e) => updateAdjustment(index, { monthlyAmount: e.target.value })}
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px', width: 140 }}
                />
              )}
              {a.type === 'NEW_HIRE' && (
                <input
                  type="number"
                  step="0.01"
                  placeholder="Costo mensual"
                  value={a.monthlyCost}
                  onChange={(e) => updateAdjustment(index, { monthlyCost: e.target.value })}
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px', width: 140 }}
                />
              )}
              {a.type === 'SALES_VARIATION' && (
                <input
                  type="number"
                  step="0.1"
                  placeholder="% (ej. 10 o -5)"
                  value={a.percentage}
                  onChange={(e) => updateAdjustment(index, { percentage: e.target.value })}
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px', width: 140 }}
                />
              )}
              {adjustments.length > 1 && (
                <button type="button" className="btn btn-small btn-danger" onClick={() => removeAdjustment(index)}>
                  Quitar
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-small" onClick={addAdjustment} style={{ marginTop: 4 }}>
            + Agregar ajuste
          </button>

          {simulateError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{simulateError}</p>}
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={isSimulating}>
              {isSimulating ? 'Simulando…' : 'Simular'}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <>
          <div className="panel">
            <div className="panel-header">
              <h2>Resultado — Utilidad</h2>
            </div>
            <table className="data-table">
              <tbody>
                <tr>
                  <td>Utilidad mensual actual (línea base)</td>
                  <td className="num">{formatCurrency(result.baseline.monthlyNetIncome)}</td>
                </tr>
                <tr>
                  <td>Utilidad mensual proyectada con el escenario</td>
                  <td className="num">{formatCurrency(result.projection.projectedMonthlyNetIncome)}</td>
                </tr>
                <tr>
                  <td>Cambio mensual</td>
                  <td className="num">{formatCurrency(result.projection.monthlyNetIncomeDelta)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Cambio acumulado en {result.projection.projectionMonths} meses</strong>
                  </td>
                  <td className="num">
                    <strong>{formatCurrency(result.projection.cumulativeNetIncomeDelta)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2 className="field-label">
                Impacto en la caja proyectada
                <HelpTooltip text="Compara la Previsión de Liquidez real de Tesorería (sin tocar) contra la misma previsión sumándole el impacto de este escenario, semana a semana." />
              </h2>
            </div>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Saldo inicial: {formatCurrency(result.liquidity.startingBalance)}. {result.liquidity.note}
            </p>
            {result.liquidity.firstNegativeWeekScenario && (
              <p className="alert-box alert-box-error" style={{ marginBottom: 12 }}>
                Con este escenario, el saldo proyectado se vuelve negativo en la semana del{' '}
                {formatDate(new Date(result.liquidity.firstNegativeWeekScenario.weekStart))}.
              </p>
            )}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th className="num">Saldo base (sin escenario)</th>
                  <th className="num">Saldo con escenario</th>
                </tr>
              </thead>
              <tbody>
                {result.liquidity.baselineWeeks.map((w, i) => (
                  <tr key={i}>
                    <td>{formatDate(new Date(w.weekStart))}</td>
                    <td className="num">{formatCurrency(w.projectedBalance)}</td>
                    <td className="num">
                      <strong
                        style={{
                          color: Number(result.liquidity.scenarioWeeks[i]?.scenarioProjectedBalance) < 0 ? 'var(--color-negative)' : undefined,
                        }}
                      >
                        {formatCurrency(result.liquidity.scenarioWeeks[i]?.scenarioProjectedBalance)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManage && (
            <div className="panel">
              <div className="panel-header">
                <h2>Guardar este escenario</h2>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Nombre</span>
                  <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="Escenario ventas +10%" />
                </label>
                <label className="field">
                  <span>Descripción (opcional)</span>
                  <input value={scenarioDescription} onChange={(e) => setScenarioDescription(e.target.value)} />
                </label>
              </div>
              {saveError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{saveError}</p>}
              {saveSuccess && <p className="alert-box alert-box-success" style={{ marginTop: 12 }}>{saveSuccess}</p>}
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={handleSaveScenario} disabled={isSaving}>
                  {isSaving ? 'Guardando…' : 'Guardar escenario'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Escenarios guardados</h2>
        </div>
        {savedScenarios.length === 0 && <EmptyState icon="□" message="Todavía no guardaste ningún escenario." />}
        {savedScenarios.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Guardado</th>
              </tr>
            </thead>
            <tbody>
              {savedScenarios.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.description || '—'}</td>
                  <td>{formatDate(new Date(s.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
