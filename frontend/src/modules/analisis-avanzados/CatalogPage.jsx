import { useEffect, useState } from 'react';
import { analysisCatalogApi, analysisRunApi, automationConfigApi, benchmarkApi } from '../../api/advanced-analytics';
import { budgetsApi } from '../../api/fpa';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';
import AnalysisResultView from './AnalysisResultView';
import { GENERIC_PARAM_SPECS, CUSTOM_PARAM_TYPES, today, startOfYear, defaultCustomParams } from './paramSpecs';

const CATEGORY_LABELS = {
  ESTRUCTURA_FINANCIERA: 'Estructura Financiera',
  RENTABILIDAD: 'Rentabilidad',
  LIQUIDEZ: 'Liquidez',
  RIESGO: 'Riesgo',
  PROYECCION: 'Proyección',
  COMPARATIVO: 'Comparativo',
};

const FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Diario' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensual' },
];

function defaultGenericParams(analysisType) {
  const spec = GENERIC_PARAM_SPECS[analysisType] || [];
  const values = {};
  for (const field of spec) values[field.key] = field.default ? field.default() : '';
  return values;
}

function GenericParamForm({ analysisType, values, onChange }) {
  const spec = GENERIC_PARAM_SPECS[analysisType] || [];
  return (
    <div className="form-grid">
      {spec.map((field) => (
        <label className="field" key={field.key}>
          <span>{field.label}</span>
          {field.type === 'select' ? (
            <select value={values[field.key] ?? ''} onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}>
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange({ ...values, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  );
}

function CustomParamForm({ analysisType, values, onChange, budgets, benchmarks }) {
  if (analysisType === 'VERTICAL') {
    const statementType = values.statementType || 'BALANCE_SHEET';
    return (
      <div className="form-grid">
        <label className="field">
          <span>Estado</span>
          <select value={statementType} onChange={(e) => onChange({ ...values, statementType: e.target.value })}>
            <option value="BALANCE_SHEET">Balance General</option>
            <option value="INCOME_STATEMENT">Estado de Resultados</option>
          </select>
        </label>
        {statementType === 'BALANCE_SHEET' ? (
          <label className="field">
            <span>Fecha de corte</span>
            <input type="date" value={values.asOfDate || today()} onChange={(e) => onChange({ ...values, asOfDate: e.target.value })} />
          </label>
        ) : (
          <>
            <label className="field">
              <span>Desde</span>
              <input type="date" value={values.from || startOfYear()} onChange={(e) => onChange({ ...values, from: e.target.value })} />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input type="date" value={values.to || today()} onChange={(e) => onChange({ ...values, to: e.target.value })} />
            </label>
          </>
        )}
      </div>
    );
  }

  if (analysisType === 'HORIZONTAL') {
    const statementType = values.statementType || 'INCOME_STATEMENT';
    return (
      <div className="form-grid">
        <label className="field">
          <span>Estado</span>
          <select value={statementType} onChange={(e) => onChange({ ...values, statementType: e.target.value })}>
            <option value="INCOME_STATEMENT">Estado de Resultados</option>
            <option value="BALANCE_SHEET">Balance General</option>
          </select>
        </label>
        {statementType === 'INCOME_STATEMENT' ? (
          <>
            <label className="field">
              <span>Periodo A — desde</span>
              <input
                type="date"
                value={values.rangeA?.from || ''}
                onChange={(e) => onChange({ ...values, rangeA: { ...values.rangeA, from: e.target.value } })}
              />
            </label>
            <label className="field">
              <span>Periodo A — hasta</span>
              <input
                type="date"
                value={values.rangeA?.to || ''}
                onChange={(e) => onChange({ ...values, rangeA: { ...values.rangeA, to: e.target.value } })}
              />
            </label>
            <label className="field">
              <span>Periodo B — desde</span>
              <input
                type="date"
                value={values.rangeB?.from || ''}
                onChange={(e) => onChange({ ...values, rangeB: { ...values.rangeB, from: e.target.value } })}
              />
            </label>
            <label className="field">
              <span>Periodo B — hasta</span>
              <input
                type="date"
                value={values.rangeB?.to || ''}
                onChange={(e) => onChange({ ...values, rangeB: { ...values.rangeB, to: e.target.value } })}
              />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Fecha A</span>
              <input type="date" value={values.asOfDateA || ''} onChange={(e) => onChange({ ...values, asOfDateA: e.target.value })} />
            </label>
            <label className="field">
              <span>Fecha B</span>
              <input type="date" value={values.asOfDateB || ''} onChange={(e) => onChange({ ...values, asOfDateB: e.target.value })} />
            </label>
          </>
        )}
      </div>
    );
  }

  if (analysisType === 'BUDGET_VS_ACTUAL') {
    return (
      <div className="form-grid">
        <label className="field">
          <span>Presupuesto</span>
          <select value={values.budgetId || ''} onChange={(e) => onChange({ ...values, budgetId: e.target.value })}>
            <option value="">Selecciona un presupuesto…</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.fiscalYear}, {b.versionType})
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (analysisType === 'WHAT_IF_SCENARIO') {
    const adjustmentType = values.adjustmentType || 'SALES_VARIATION';
    return (
      <div className="form-grid">
        <label className="field">
          <span>Desde (línea base)</span>
          <input type="date" value={values.baselineFrom || startOfYear()} onChange={(e) => onChange({ ...values, baselineFrom: e.target.value })} />
        </label>
        <label className="field">
          <span>Hasta (línea base)</span>
          <input type="date" value={values.baselineTo || today()} onChange={(e) => onChange({ ...values, baselineTo: e.target.value })} />
        </label>
        <label className="field">
          <span>Meses a proyectar</span>
          <input
            type="number"
            value={values.projectionMonths ?? 6}
            onChange={(e) => onChange({ ...values, projectionMonths: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Tipo de ajuste</span>
          <select value={adjustmentType} onChange={(e) => onChange({ ...values, adjustmentType: e.target.value })}>
            <option value="SALES_VARIATION">Variación de ventas (%)</option>
            <option value="RECURRING_EXPENSE">Gasto recurrente nuevo</option>
            <option value="NEW_HIRE">Nueva contratación</option>
          </select>
        </label>
        <label className="field">
          <span>Monto / porcentaje del ajuste</span>
          <input type="number" value={values.adjustmentValue ?? ''} onChange={(e) => onChange({ ...values, adjustmentValue: Number(e.target.value) })} />
        </label>
        <p className="text-muted" style={{ gridColumn: '1 / -1' }}>
          Para escenarios con varios ajustes a la vez, usa el Simulador completo en FP&A.
        </p>
      </div>
    );
  }

  if (analysisType === 'INVESTMENT_EVALUATION') {
    return (
      <div className="form-grid">
        <label className="field">
          <span>Inversión inicial</span>
          <input
            type="number"
            value={values.initialInvestment ?? ''}
            onChange={(e) => onChange({ ...values, initialInvestment: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Tasa de descuento (ej. 0.10 = 10%)</span>
          <input type="number" step="0.01" value={values.discountRate ?? 0.1} onChange={(e) => onChange({ ...values, discountRate: Number(e.target.value) })} />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Flujos de caja futuros, uno por periodo, separados por coma (ej. 500, 500, 500)</span>
          <input type="text" value={values.cashFlowsText ?? ''} onChange={(e) => onChange({ ...values, cashFlowsText: e.target.value })} />
        </label>
      </div>
    );
  }

  if (analysisType === 'BENCHMARKING') {
    return (
      <div className="form-grid">
        <label className="field">
          <span>Métrica de referencia</span>
          <select value={values.metricKey || ''} onChange={(e) => onChange({ ...values, metricKey: e.target.value })}>
            <option value="">Selecciona una métrica…</option>
            {benchmarks.map((b) => (
              <option key={b.metricKey} value={b.metricKey}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tu valor real para esta métrica</span>
          <input type="number" step="0.01" value={values.actualValue ?? ''} onChange={(e) => onChange({ ...values, actualValue: Number(e.target.value) })} />
        </label>
        {benchmarks.length === 0 && (
          <p className="text-muted" style={{ gridColumn: '1 / -1' }}>
            Todavía no hay valores de referencia configurados — pídele al Administrador que agregue uno en la pestaña Benchmarking.
          </p>
        )}
      </div>
    );
  }

  return null;
}

function buildParameters(analysisType, values) {
  if (analysisType === 'WHAT_IF_SCENARIO') {
    const { baselineFrom, baselineTo, projectionMonths, adjustmentType, adjustmentValue } = values;
    const adjustment =
      adjustmentType === 'SALES_VARIATION'
        ? { type: 'SALES_VARIATION', percentage: adjustmentValue || 0 }
        : adjustmentType === 'RECURRING_EXPENSE'
          ? { type: 'RECURRING_EXPENSE', monthlyAmount: adjustmentValue || 0 }
          : { type: 'NEW_HIRE', monthlyCost: adjustmentValue || 0 };
    return { baselineFrom, baselineTo, projectionMonths, adjustments: [adjustment] };
  }
  if (analysisType === 'INVESTMENT_EVALUATION') {
    const cashFlows = (values.cashFlowsText || '')
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v));
    return { initialInvestment: values.initialInvestment, discountRate: values.discountRate, cashFlows };
  }
  const { cashFlowsText: _cashFlowsText, adjustmentType: _adjustmentType, adjustmentValue: _adjustmentValue, ...rest } = values;
  return rest;
}

function AnalysisCard({ entry, canManage, isExpanded, onToggle, values, onValuesChange, budgets, benchmarks, automation, onRun, onAutomationChange }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          {entry.label}
          <HelpTooltip text={entry.simpleDescription} />
        </h2>
        <button type="button" className="btn btn-small" onClick={onToggle}>
          {isExpanded ? 'Ocultar' : 'Ver'}
        </button>
      </div>
      <p className="text-muted">{entry.simpleDescription}</p>

      {isExpanded && (
        <>
          {canManage ? (
            <>
              {CUSTOM_PARAM_TYPES.includes(entry.analysisType) ? (
                <CustomParamForm analysisType={entry.analysisType} values={values} onChange={onValuesChange} budgets={budgets} benchmarks={benchmarks} />
              ) : (
                <GenericParamForm analysisType={entry.analysisType} values={values} onChange={onValuesChange} />
              )}
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={onRun.handler} disabled={onRun.isRunning}>
                  {onRun.isRunning ? 'Ejecutando…' : 'Ejecutar ahora'}
                </button>
              </div>
              {onRun.error && <p className="alert-box alert-box-error">{onRun.error}</p>}

              <div className="field-checkbox" style={{ marginTop: 16 }}>
                <input
                  type="checkbox"
                  id={`auto-${entry.analysisType}`}
                  checked={automation?.isEnabled || false}
                  onChange={(e) => onAutomationChange({ isEnabled: e.target.checked, frequency: automation?.frequency || 'DAILY' })}
                />
                <label htmlFor={`auto-${entry.analysisType}`}>Automatizar</label>
                <HelpTooltip text="Si lo activas, este análisis se vuelve a correr solo (con estos mismos parámetros) y queda archivado, sin que tengas que entrar a ejecutarlo cada vez." />
                {automation?.isEnabled && (
                  <select
                    value={automation.frequency || 'DAILY'}
                    onChange={(e) => onAutomationChange({ isEnabled: true, frequency: e.target.value })}
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted">Tu rol solo puede ver este análisis en modo lectura — pídele a un Administrador o Financiero que lo ejecute.</p>
          )}

          {onRun.result && <AnalysisResultView report={onRun.result} />}
        </>
      )}
    </div>
  );
}

export default function CatalogPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [catalog, setCatalog] = useState([]);
  const [automationConfigs, setAutomationConfigs] = useState({});
  const [budgets, setBudgets] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [expandedType, setExpandedType] = useState(null);
  const [paramValues, setParamValues] = useState({});
  const [results, setResults] = useState({});
  const [runningType, setRunningType] = useState(null);
  const [runError, setRunError] = useState('');

  useEffect(() => {
    analysisCatalogApi
      .list()
      .then(setCatalog)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo.'));
    automationConfigApi
      .list()
      .then((list) => {
        const map = {};
        for (const config of list) map[config.analysisType] = config;
        setAutomationConfigs(map);
      })
      .catch(() => setAutomationConfigs({}));
    // Presupuestos vive en FP&A (ADMIN/FINANCE únicamente) — un Contador
    // en modo lectura nunca ve el formulario que los necesita, así que ni
    // vale la pena pedirlos (evita un 403 innecesario en la consola).
    if (canManage) budgetsApi.list().then(setBudgets).catch(() => setBudgets([]));
    benchmarkApi.list().then(setBenchmarks).catch(() => setBenchmarks([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCard(analysisType) {
    if (expandedType === analysisType) {
      setExpandedType(null);
      return;
    }
    setExpandedType(analysisType);
    setRunError('');
    if (!paramValues[analysisType]) {
      const defaults = CUSTOM_PARAM_TYPES.includes(analysisType) ? defaultCustomParams(analysisType) : defaultGenericParams(analysisType);
      setParamValues((prev) => ({ ...prev, [analysisType]: defaults }));
    }
  }

  async function handleRun(analysisType) {
    setRunningType(analysisType);
    setRunError('');
    try {
      const parameters = buildParameters(analysisType, paramValues[analysisType] || {});
      const report = await analysisRunApi.run(analysisType, parameters);
      setResults((prev) => ({ ...prev, [analysisType]: report }));
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : 'No se pudo ejecutar el análisis.');
    } finally {
      setRunningType(null);
    }
  }

  async function handleAutomationChange(analysisType, changes) {
    const parameters = buildParameters(analysisType, paramValues[analysisType] || {});
    const updated = await automationConfigApi.upsert(analysisType, { ...changes, defaultParameters: parameters });
    setAutomationConfigs((prev) => ({ ...prev, [analysisType]: updated }));
  }

  const grouped = catalog.reduce((acc, entry) => {
    acc[entry.category] = acc[entry.category] || [];
    acc[entry.category].push(entry);
    return acc;
  }, {});

  if (loadError) return <p className="alert-box alert-box-error">{loadError}</p>;
  if (catalog.length === 0) return <EmptyState message="Cargando el catálogo de análisis…" />;

  return (
    <div>
      {Object.entries(CATEGORY_LABELS).map(([category, label]) =>
        grouped[category] ? (
          <div key={category}>
            <h2 className="section-title">{label}</h2>
            {grouped[category].map((entry) => (
              <AnalysisCard
                key={entry.analysisType}
                entry={entry}
                canManage={canManage}
                isExpanded={expandedType === entry.analysisType}
                onToggle={() => toggleCard(entry.analysisType)}
                values={paramValues[entry.analysisType] || {}}
                onValuesChange={(values) => setParamValues((prev) => ({ ...prev, [entry.analysisType]: values }))}
                budgets={budgets}
                benchmarks={benchmarks}
                automation={automationConfigs[entry.analysisType]}
                onRun={{
                  handler: () => handleRun(entry.analysisType),
                  isRunning: runningType === entry.analysisType,
                  error: expandedType === entry.analysisType ? runError : '',
                  result: results[entry.analysisType],
                }}
                onAutomationChange={(changes) => handleAutomationChange(entry.analysisType, changes)}
              />
            ))}
          </div>
        ) : null
      )}
    </div>
  );
}
