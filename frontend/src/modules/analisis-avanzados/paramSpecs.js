// Especificación de qué parámetros pide cada análisis en el formulario
// de "Ejecutar ahora". Los 10 análisis más simples (fecha o rango de
// fechas, a veces un select) usan esta tabla genérica; los 6 restantes
// (Vertical, Horizontal, Presupuesto vs. Real, What-If, Evaluación de
// Inversiones, Benchmarking) necesitan un formulario propio porque sus
// parámetros no son solo fechas — ver CatalogPage.jsx.
export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

export const GENERIC_PARAM_SPECS = {
  FINANCIAL_RATIOS: [
    { key: 'asOfDate', label: 'Fecha de corte', type: 'date', default: today },
    { key: 'from', label: 'Desde', type: 'date', default: startOfYear },
    { key: 'to', label: 'Hasta', type: 'date', default: today },
  ],
  CASH_FLOW: [
    { key: 'from', label: 'Desde', type: 'date', default: startOfYear },
    { key: 'to', label: 'Hasta', type: 'date', default: today },
  ],
  BREAK_EVEN: [
    { key: 'from', label: 'Desde', type: 'date', default: startOfYear },
    { key: 'to', label: 'Hasta', type: 'date', default: today },
  ],
  CVU: [
    { key: 'from', label: 'Desde', type: 'date', default: startOfYear },
    { key: 'to', label: 'Hasta', type: 'date', default: today },
  ],
  WORKING_CAPITAL: [
    { key: 'asOfDate', label: 'Fecha de corte', type: 'date', default: today },
    { key: 'from', label: 'Desde (para el ciclo de conversión)', type: 'date', default: startOfYear },
    { key: 'to', label: 'Hasta', type: 'date', default: today },
  ],
  DUPONT: [
    { key: 'asOfDate', label: 'Fecha de corte', type: 'date', default: today },
    { key: 'from', label: 'Desde', type: 'date', default: startOfYear },
    { key: 'to', label: 'Hasta', type: 'date', default: today },
  ],
  FINANCIAL_RISK_LEVERAGE: [
    { key: 'asOfDate', label: 'Fecha de corte', type: 'date', default: today },
    { key: 'from', label: 'Desde', type: 'date', default: startOfYear },
    { key: 'to', label: 'Hasta', type: 'date', default: today },
  ],
  TREND_ANALYSIS: [
    {
      key: 'metric',
      label: 'Métrica',
      type: 'select',
      default: () => 'NET_INCOME',
      options: [
        { value: 'REVENUE', label: 'Ingresos' },
        { value: 'EXPENSE', label: 'Gastos' },
        { value: 'NET_INCOME', label: 'Utilidad Neta' },
      ],
    },
    { key: 'months', label: 'Meses hacia atrás', type: 'number', default: () => 6 },
  ],
  PREDICTIVE_FORECAST: [{ key: 'weeks', label: 'Semanas a proyectar', type: 'number', default: () => 8 }],
  PROFITABILITY_SEGMENT: [
    {
      key: 'segmentType',
      label: 'Segmento',
      type: 'select',
      default: () => 'PRODUCT',
      options: [
        { value: 'PRODUCT', label: 'Producto' },
        { value: 'CLIENT', label: 'Cliente' },
      ],
    },
    { key: 'from', label: 'Desde', type: 'date', default: startOfYear },
    { key: 'to', label: 'Hasta', type: 'date', default: today },
  ],
};

export const CUSTOM_PARAM_TYPES = ['VERTICAL', 'HORIZONTAL', 'BUDGET_VS_ACTUAL', 'WHAT_IF_SCENARIO', 'INVESTMENT_EVALUATION', 'BENCHMARKING'];

// Los 6 formularios con parámetros propios muestran un valor por
// defecto en pantalla (ej. "hoy" en un campo de fecha) usando
// `value={values.x || today()}` — eso es solo una vista, no guarda
// nada en el estado hasta que el usuario toca el campo. Si nunca lo
// toca, el parámetro real que se manda al backend queda `undefined` y
// varias fórmulas (ej. VAN, meses entre fechas) no toleran eso. Por
// eso el estado se arranca ya con estos valores reales, no vacío.
export function defaultCustomParams(analysisType) {
  switch (analysisType) {
    case 'VERTICAL':
      return { statementType: 'BALANCE_SHEET', asOfDate: today(), from: startOfYear(), to: today() };
    case 'HORIZONTAL':
      return { statementType: 'INCOME_STATEMENT', rangeA: { from: '', to: '' }, rangeB: { from: '', to: '' }, asOfDateA: '', asOfDateB: '' };
    case 'BUDGET_VS_ACTUAL':
      return { budgetId: '' };
    case 'WHAT_IF_SCENARIO':
      return { baselineFrom: startOfYear(), baselineTo: today(), projectionMonths: 6, adjustmentType: 'SALES_VARIATION', adjustmentValue: 0 };
    case 'INVESTMENT_EVALUATION':
      return { initialInvestment: 0, discountRate: 0.1, cashFlowsText: '' };
    case 'BENCHMARKING':
      return { metricKey: '', actualValue: 0 };
    default:
      return {};
  }
}
