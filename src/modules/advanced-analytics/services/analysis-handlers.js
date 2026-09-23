// Los 16 handlers de Análisis Avanzados. Cada uno recibe (companyId,
// parameters) y devuelve las 6 partes obligatorias — nunca escribe en
// otro módulo, nunca recalcula un dato que otro módulo ya calculó.
//
// "REUTILIZAR" llama directo al servicio original y solo le agrega la
// capa de explicación; "NUEVO" usa las reglas puras de este módulo
// sobre datos que sí vienen de otros módulos (shared-data.js).
const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');
const prisma = require('../../../core/database/prisma');

const accountingReportsService = require('../../accounting/services/reports.service');
const cashFlowService = require('../../reports/services/cash-flow.service');
const profitabilityService = require('../../reports/services/profitability.service');
const budgetVarianceService = require('../../fpa/services/budget-variance.service');
const scenariosService = require('../../fpa/services/scenarios.service');
const liquidityForecastService = require('../../treasury/services/liquidity-forecast.service');

const sharedData = require('./shared-data');
const { calculateVerticalAnalysis } = require('./vertical.rules');
const { calculateFinancialRatios } = require('./financial-ratios.rules');
const { calculateBreakEven } = require('./break-even.rules');
const { projectCvuScenarios } = require('./cvu.rules');
const { calculateWorkingCapital, calculateCashConversionCycle } = require('./working-capital.rules');
const { calculateDupont } = require('./dupont.rules');
const { computeTrendStats } = require('./trend-analysis.rules');
const { evaluateInvestment } = require('./investment-evaluation.rules');
const {
  calculateOperatingLeverage,
  calculateFinancialLeverage,
  calculateCombinedLeverage,
  calculateFxExposureRatio,
} = require('./financial-risk-leverage.rules');
const { compareToBenchmark } = require('./benchmarking.rules');

const { Decimal } = Prisma;

function rec(text, { quantifiedType = 'NONE', quantifiedValue = null, isPrimary = false } = {}) {
  return { text, quantifiedType, quantifiedValue, isPrimary };
}

function shiftMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function monthLabel(date) {
  return new Date(date).toISOString().slice(0, 7);
}

// Los parámetros llegan del body de la petición (o de
// `defaultParameters` guardado como JSON) como texto plano — Prisma
// exige un `Date` real (o un ISO-8601 completo con hora) para filtrar
// por fecha, si no falla con "premature end of input". Mismo bug ya
// documentado en `scheduled-reports.service.runScheduledReport`; acá
// se corrige de una vez en el punto de entrada de cada handler, no
// donde revienta.
function toDate(value) {
  return value === undefined || value === null ? value : new Date(value);
}

function toDateRange(range) {
  if (!range) return range;
  return { from: toDate(range.from), to: toDate(range.to) };
}

// `Date` no tiene `.slice()` — a diferencia de cuando un valor viaja
// por HTTP (donde Express ya lo serializó a texto ISO), acá se llama
// al servicio directo en el mismo proceso, así que `weekStart` sigue
// siendo un objeto `Date` real.
function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

// =====================================================================
// 1. VERTICAL — NUEVO (liviano)
// =====================================================================
async function runVertical(companyId, parameters) {
  const statementType = parameters.statementType === 'INCOME_STATEMENT' ? 'INCOME_STATEMENT' : 'BALANCE_SHEET';

  let rows;
  let base;
  let baseLabel;
  if (statementType === 'INCOME_STATEMENT') {
    const statement = await accountingReportsService.getIncomeStatement(companyId, { from: toDate(parameters.from), to: toDate(parameters.to) });
    rows = Object.values(statement.sections).flat();
    base = statement.totalIncome;
    baseLabel = 'el total de ingresos del periodo';
  } else {
    const statement = await accountingReportsService.getBalanceSheet(companyId, toDate(parameters.asOfDate));
    rows = Object.values(statement.sections).flat().map((r) => ({ ...r, amount: r.balance }));
    base = statement.totalAssets;
    baseLabel = 'el total de activos';
  }

  const analyzed = calculateVerticalAnalysis(rows, base);
  const sorted = [...analyzed].sort((a, b) => new Decimal(b.percentOfBase).minus(a.percentOfBase).toNumber());
  const top = sorted[0];

  return {
    numericResult: { statementType, baseAmount: new Decimal(base).toFixed(2), rows: analyzed.map((r) => ({ code: r.code, name: r.name, percentOfBase: r.percentOfBase.toFixed(2) })) },
    chartType: 'COMPOSITION',
    chartData: analyzed.map((r) => ({ name: r.name, value: r.percentOfBase.toNumber() })),
    causeExplanation: top
      ? `"${top.name}" es la partida más grande, con ${top.percentOfBase.toFixed(1)}% de ${baseLabel} — esa es la línea que más pesa en la estructura de este periodo.`
      : 'No hay movimientos en el periodo consultado para analizar su estructura.',
    simpleInterpretation:
      'Este análisis muestra qué tan grande es cada parte de tu negocio comparada con el total, como si el total fuera 100%. Te ayuda a ver de un vistazo en qué se concentra tu dinero.',
    methodology: `Se tomó ${statementType === 'INCOME_STATEMENT' ? 'el Estado de Resultados' : 'el Balance General'} de Contabilidad y se calculó el porcentaje de cada cuenta sobre ${baseLabel} (monto de la cuenta ÷ base × 100).`,
    recommendations: top
      ? [
          rec(`Revisa si concentrar ${top.percentOfBase.toFixed(0)}% en "${top.name}" es una decisión deliberada o un riesgo de depender de una sola partida.`, {
            quantifiedType: 'PERCENTAGE',
            quantifiedValue: top.percentOfBase.toNumber(),
            isPrimary: true,
          }),
        ]
      : [rec('Registra movimientos en este periodo para poder analizar su estructura.')],
  };
}

// =====================================================================
// 2. HORIZONTAL — REUTILIZAR (accounting/reports.service)
// =====================================================================
async function runHorizontal(companyId, parameters) {
  const statementType = parameters.statementType === 'INCOME_STATEMENT' ? 'INCOME_STATEMENT' : 'BALANCE_SHEET';

  let comparison;
  let chartData;
  if (statementType === 'INCOME_STATEMENT') {
    comparison = await accountingReportsService.compareIncomeStatements(companyId, toDateRange(parameters.rangeA), toDateRange(parameters.rangeB));
    chartData = [
      { name: 'Ingresos', periodoA: Number(comparison.periodA.totalIncome), periodoB: Number(comparison.periodB.totalIncome) },
      { name: 'Gastos', periodoA: Number(comparison.periodA.totalExpense), periodoB: Number(comparison.periodB.totalExpense) },
      { name: 'Utilidad Neta', periodoA: Number(comparison.periodA.netIncome), periodoB: Number(comparison.periodB.netIncome) },
    ];
  } else {
    comparison = await accountingReportsService.compareBalanceSheets(companyId, toDate(parameters.asOfDateA), toDate(parameters.asOfDateB));
    chartData = [
      { name: 'Activos', periodoA: Number(comparison.periodA.totalAssets), periodoB: Number(comparison.periodB.totalAssets) },
      { name: 'Pasivos', periodoA: Number(comparison.periodA.totalLiabilities), periodoB: Number(comparison.periodB.totalLiabilities) },
    ];
  }

  const mainChange = statementType === 'INCOME_STATEMENT' ? comparison.netIncomeChange : comparison.totalAssetsChange;
  const changePercent = mainChange.variancePercent === null ? null : Number(mainChange.variancePercent);

  return {
    numericResult: { statementType, comparison },
    chartType: 'COMPARISON',
    chartData,
    causeExplanation:
      changePercent === null
        ? 'No se puede comparar el cambio en porcentaje porque el primer periodo no tuvo movimiento.'
        : `${statementType === 'INCOME_STATEMENT' ? 'La utilidad neta' : 'El total de activos'} cambió ${changePercent >= 0 ? 'un aumento' : 'una caída'} de ${Math.abs(changePercent).toFixed(1)}% entre los dos periodos comparados.`,
    simpleInterpretation:
      'Este análisis compara dos periodos, cuenta por cuenta, para ver qué creció, qué bajó, y en cuánto — así puedes notar cambios importantes rápido.',
    methodology: `Se llamó al comparativo ya existente de Contabilidad (${statementType === 'INCOME_STATEMENT' ? 'compareIncomeStatements' : 'compareBalanceSheets'}) entre los dos periodos indicados, sin recalcular nada.`,
    recommendations:
      changePercent !== null && Math.abs(changePercent) >= 20
        ? [rec(`El cambio de ${changePercent.toFixed(1)}% es grande — vale la pena investigar la causa concreta antes del cierre del periodo.`, { quantifiedType: 'PERCENTAGE', quantifiedValue: changePercent, isPrimary: true })]
        : [rec('El cambio entre periodos está dentro de un rango esperado; sigue monitoreando mes a mes.')],
  };
}

// =====================================================================
// 3. FINANCIAL_RATIOS — NUEVO
// =====================================================================
async function runFinancialRatios(companyId, parameters) {
  const [balance, income] = await Promise.all([
    sharedData.getBalanceSheetTotals(companyId, parameters.asOfDate),
    sharedData.getIncomeStatementTotals(companyId, parameters.from, parameters.to),
  ]);

  const ratios = calculateFinancialRatios({
    currentAssets: balance.currentAssets,
    currentLiabilities: balance.currentLiabilities,
    inventory: balance.inventory,
    totalAssets: balance.totalAssets,
    totalLiabilities: balance.totalLiabilities,
    totalEquity: balance.totalEquity,
    netIncome: income.netIncome,
    revenue: income.revenue,
    cogs: income.cogs,
    averageInventory: balance.inventory,
  });

  const flatten = (group) =>
    Object.entries(group).map(([key, value]) => ({ name: key, value: value === null ? null : value.toFixed(4) }));

  const numericResult = {
    liquidity: flatten(ratios.liquidity),
    solvency: flatten(ratios.solvency),
    profitability: flatten(ratios.profitability),
    activity: flatten(ratios.activity),
    valuation: flatten(ratios.valuation),
  };

  const chartData = [...numericResult.liquidity, ...numericResult.solvency, ...numericResult.profitability, ...numericResult.activity]
    .filter((r) => r.value !== null)
    .map((r) => ({ name: r.name, value: Number(r.value) }));

  const currentRatio = ratios.liquidity.currentRatio;
  const lowLiquidity = currentRatio !== null && currentRatio.lessThan(1);

  return {
    numericResult,
    chartType: 'COMPARISON',
    chartData,
    causeExplanation: lowLiquidity
      ? `La razón corriente dio ${currentRatio.toFixed(2)} — tus deudas de corto plazo (${balance.currentLiabilities.toFixed(2)}) superan lo que tienes disponible para pagarlas pronto (${balance.currentAssets.toFixed(2)}).`
      : `Los indicadores se calcularon con el Balance General al ${parameters.asOfDate} y el Estado de Resultados del periodo — ningún indicador muestra una señal de alerta fuerte por ahora.`,
    simpleInterpretation:
      'Estos números resumen la salud financiera de tu negocio: si puedes pagar tus deudas a tiempo, si tienes mucha o poca deuda, si ganas dinero de verdad, y qué tan rápido mueves lo que tienes.',
    methodology:
      'Se combinaron montos ya calculados del Balance General y el Estado de Resultados de Contabilidad en las fórmulas clásicas de liquidez, solvencia, rentabilidad, actividad y valuación (esta última limitada al valor en libros, porque no hay cotización de mercado disponible).',
    recommendations: lowLiquidity
      ? [rec(`Tu razón corriente (${currentRatio.toFixed(2)}) está por debajo de 1 — cada peso de deuda de corto plazo no está cubierto por un peso de activo corriente. Prioriza cobrar cuentas pendientes o renegociar plazos con proveedores.`, { quantifiedType: 'NONE', isPrimary: true })]
      : [rec('Tu liquidez de corto plazo luce sana; sigue revisando estos indicadores cada mes para detectar cambios a tiempo.')],
  };
}

// =====================================================================
// 4. CASH_FLOW — REUTILIZAR (reports/cash-flow.service), con serie
// mensual para el gráfico de tendencia.
// =====================================================================
async function runCashFlow(companyId, parameters) {
  const from = new Date(parameters.from);
  const to = new Date(parameters.to);
  const full = await cashFlowService.getCashFlowStatement(companyId, { from, to });

  const monthlyPoints = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor < to) {
    const monthEnd = shiftMonths(cursor, 1) > to ? to : shiftMonths(cursor, 1);

    const monthResult = await cashFlowService.getCashFlowStatement(companyId, { from: cursor, to: monthEnd });
    monthlyPoints.push({ month: monthLabel(cursor), netChangeInCash: Number(monthResult.indirect.netChangeInCash) });
    cursor = monthEnd;
  }

  return {
    numericResult: {
      operating: full.indirect.operating.total,
      investing: full.indirect.investing.total,
      financing: full.indirect.financing.total,
      netChangeInCash: full.indirect.netChangeInCash,
      reconciles: full.indirect.reconciles,
    },
    chartType: 'TREND_LINE',
    chartData: monthlyPoints,
    causeExplanation: `El efectivo cambió ${Number(full.indirect.netChangeInCash) >= 0 ? 'positivamente' : 'negativamente'} en el periodo: operación aportó ${full.indirect.operating.total}, inversión ${full.indirect.investing.total} y financiamiento ${full.indirect.financing.total}.`,
    simpleInterpretation:
      'Muestra de dónde entró y hacia dónde salió el dinero de tu caja: de vender y operar el día a día, de comprar o vender activos, o de pedir/pagar préstamos y capital.',
    methodology: 'Se llamó al Flujo de Efectivo ya existente de Reportes (método indirecto) para el periodo completo, y mes a mes para armar la serie de tendencia.',
    recommendations: full.indirect.reconciles
      ? [rec('El flujo de efectivo cuadra exacto contra el cambio real de caja — los datos de Contabilidad y Tesorería están consistentes.')]
      : [rec('El flujo de efectivo NO cuadra contra el cambio real de caja — revisa si hay movimientos contabilizados fuera de las cuentas de Tesorería.', { isPrimary: true })],
  };
}

// =====================================================================
// 5. BREAK_EVEN — NUEVO
// =====================================================================
async function runBreakEven(companyId, parameters) {
  const income = await sharedData.getIncomeStatementTotals(companyId, parameters.from, parameters.to);
  const costs = await sharedData.getCostBreakdown(companyId, income.rawIncomeStatement);
  const result = calculateBreakEven({ totalRevenue: income.revenue, fixedCosts: costs.fixedCosts, variableCosts: costs.variableCosts });

  const scenarios = projectCvuScenarios({
    totalRevenue: income.revenue,
    fixedCosts: costs.fixedCosts,
    variableCosts: costs.variableCosts,
    volumeMultipliers: ['0', '0.5', '1', '1.5', '2'],
  });

  return {
    numericResult: {
      breakEvenRevenue: result.isAchievable ? result.breakEvenRevenue.toFixed(2) : null,
      isAchievable: result.isAchievable,
      contributionMarginRatio: result.contributionMarginRatio.times(100).toFixed(2),
      currentRevenue: income.revenue.toFixed(2),
      safetyMarginPercent: result.safetyMarginPercent ? result.safetyMarginPercent.toFixed(2) : null,
      unclassifiedCostAmount: costs.unclassifiedCount > 0 ? costs.unclassifiedAmount.toFixed(2) : null,
    },
    chartType: 'TREND_LINE',
    chartData: scenarios.map((s) => ({
      volume: s.volumeMultiplier.toNumber(),
      ingresos: s.projectedRevenue.toNumber(),
      costoTotal: s.projectedVariableCosts.plus(s.fixedCosts).toNumber(),
    })),
    causeExplanation: result.isAchievable
      ? `Necesitas vender ${result.breakEvenRevenue.toFixed(2)} para cubrir tus costos fijos (${costs.fixedCosts.toFixed(2)}) con un margen de contribución de ${result.contributionMarginRatio.times(100).toFixed(1)}% sobre cada venta.`
      : `Con tus costos variables actuales (${costs.variableCosts.toFixed(2)}) igualando o superando tus ingresos (${income.revenue.toFixed(2)}), no existe un nivel de venta que alcance el equilibrio — cada venta adicional pierde dinero.`,
    simpleInterpretation: result.isAchievable
      ? `Hoy vendiste ${income.revenue.toFixed(2)} y tu punto de equilibrio es ${result.breakEvenRevenue.toFixed(2)} — ${result.safetyMarginRevenue && result.safetyMarginRevenue.greaterThan(0) ? 'ya lo superaste, tienes un colchón antes de perder dinero' : 'todavía no lo alcanzas'}.`
      : 'Con la estructura de costos actual, vender más no te saca de pérdidas — necesitas bajar el costo variable por venta o subir el precio.',
    methodology: `Ingresos y costo variable/fijo del periodo (Estado de Resultados de Contabilidad), clasificando cada cuenta de gasto como fija o variable según lo configurado en Análisis Avanzados${costs.unclassifiedCount > 0 ? ` (${costs.unclassifiedCount} cuenta(s) sin clasificar se trataron como costo fijo por defecto)` : ''}. Punto de equilibrio = Costos Fijos ÷ (1 − Costo Variable/Ingresos).`,
    recommendations: result.isAchievable
      ? [
          rec(`Tu margen de seguridad es ${result.safetyMarginPercent ? result.safetyMarginPercent.toFixed(1) : '0'}% — una caída de ventas mayor a eso te llevaría a pérdidas.`, {
            quantifiedType: 'PERCENTAGE',
            quantifiedValue: result.safetyMarginPercent ? result.safetyMarginPercent.toNumber() : 0,
            isPrimary: true,
          }),
        ]
      : [rec('Revisa si puedes reducir el costo variable por unidad vendida o subir precios — con la estructura actual, más ventas no resuelven el problema.', { isPrimary: true })],
  };
}

// =====================================================================
// 6. CVU — NUEVO (extiende Break-Even)
// =====================================================================
async function runCvu(companyId, parameters) {
  const income = await sharedData.getIncomeStatementTotals(companyId, parameters.from, parameters.to);
  const costs = await sharedData.getCostBreakdown(companyId, income.rawIncomeStatement);
  const multipliers = parameters.volumeMultipliers || ['0.5', '0.75', '1', '1.25', '1.5'];
  const scenarios = projectCvuScenarios({ totalRevenue: income.revenue, fixedCosts: costs.fixedCosts, variableCosts: costs.variableCosts, volumeMultipliers: multipliers });

  const best = scenarios[scenarios.length - 1];
  const worst = scenarios[0];

  return {
    numericResult: {
      scenarios: scenarios.map((s) => ({
        volumeMultiplier: s.volumeMultiplier.toFixed(2),
        projectedRevenue: s.projectedRevenue.toFixed(2),
        projectedProfit: s.projectedProfit.toFixed(2),
      })),
    },
    chartType: 'TREND_LINE',
    chartData: scenarios.map((s) => ({ volume: s.volumeMultiplier.toNumber(), utilidad: s.projectedProfit.toNumber() })),
    causeExplanation: `Si el volumen de venta pasa de ${worst.volumeMultiplier.times(100).toFixed(0)}% a ${best.volumeMultiplier.times(100).toFixed(0)}% del nivel actual, la utilidad se mueve de ${worst.projectedProfit.toFixed(2)} a ${best.projectedProfit.toFixed(2)} — porque el costo fijo (${costs.fixedCosts.toFixed(2)}) no cambia, cada venta extra pesa más en la utilidad.`,
    simpleInterpretation: 'Muestra cuánto ganarías o perderías si vendes más o menos que hoy, para que puedas planear metas de venta con una idea realista de la utilidad esperada.',
    methodology: 'Se proyectó el ingreso y el costo variable escalando en proporción directa al volumen simulado, manteniendo el costo fijo constante (simplificación estándar de corto plazo).',
    recommendations: [
      rec(`Un aumento del 25% en volumen sobre el nivel actual proyecta una utilidad de ${scenarios.find((s) => s.volumeMultiplier.toString() === '1.25')?.projectedProfit.toFixed(2) || 'N/D'}.`, { isPrimary: true }),
      rec('Usa este análisis antes de decidir una campaña de ventas: te dice si el volumen extra realmente compensa el costo de conseguirlo.'),
    ],
  };
}

// =====================================================================
// 7. WORKING_CAPITAL — NUEVO
// =====================================================================
async function runWorkingCapital(companyId, parameters) {
  const balance = await sharedData.getBalanceSheetTotals(companyId, parameters.asOfDate);
  const result = calculateWorkingCapital({ currentAssets: balance.currentAssets, currentLiabilities: balance.currentLiabilities });

  let ccc = null;
  if (parameters.from && parameters.to) {
    const income = await sharedData.getIncomeStatementTotals(companyId, parameters.from, parameters.to);
    if (income.revenue.greaterThan(0) && income.cogs.greaterThan(0)) {
      const periodDays = Math.max(1, Math.round((new Date(parameters.to) - new Date(parameters.from)) / (24 * 60 * 60 * 1000)));
      ccc = calculateCashConversionCycle({
        averageReceivables: balance.currentAssets,
        averageInventory: balance.inventory,
        averagePayables: balance.currentLiabilities,
        revenue: income.revenue,
        cogs: income.cogs,
        periodDays,
      });
    }
  }

  return {
    numericResult: {
      workingCapital: result.workingCapital.toFixed(2),
      currentRatio: result.currentRatio ? result.currentRatio.toFixed(2) : null,
      cashConversionCycleDays: ccc ? ccc.cashConversionCycle.toFixed(1) : null,
    },
    chartType: 'COMPOSITION',
    chartData: [
      { name: 'Activo Corriente', value: balance.currentAssets.toNumber() },
      { name: 'Pasivo Corriente', value: balance.currentLiabilities.toNumber() },
    ],
    causeExplanation: result.workingCapital.lessThan(0)
      ? `Tus pasivos de corto plazo (${balance.currentLiabilities.toFixed(2)}) superan tus activos de corto plazo (${balance.currentAssets.toFixed(2)}) por ${result.workingCapital.abs().toFixed(2)}.`
      : `Te queda un colchón de ${result.workingCapital.toFixed(2)} entre lo que puedes volver efectivo pronto y lo que debes pagar pronto.`,
    simpleInterpretation: result.workingCapital.lessThan(0)
      ? 'Tu negocio podría tener problemas para pagar sus deudas de corto plazo con lo que tiene disponible ahora mismo.'
      : 'Tu negocio tiene margen para cubrir sus deudas de corto plazo con lo que puede volverse efectivo pronto.',
    methodology: 'Capital de Trabajo = Activo Corriente − Pasivo Corriente, tomados del Balance General de Contabilidad. El Ciclo de Conversión de Efectivo (si se indicó un rango de fechas) combina esos mismos saldos con los ingresos y el costo de venta del periodo.',
    recommendations: result.workingCapital.lessThan(0)
      ? [rec(`Te faltan ${result.workingCapital.abs().toFixed(2)} para cubrir tus deudas de corto plazo con activos de corto plazo — considera acelerar cobros o una línea de crédito de respaldo.`, { quantifiedType: 'AMOUNT', quantifiedValue: result.workingCapital.abs().toNumber(), isPrimary: true })]
      : [rec('Tu capital de trabajo es positivo; sigue vigilando que no se achique si crecen las ventas a crédito.')],
  };
}

// =====================================================================
// 8. PROFITABILITY_SEGMENT — REUTILIZAR (reports/profitability.service)
// =====================================================================
async function runProfitabilitySegment(companyId, parameters) {
  const segmentType = parameters.segmentType === 'CLIENT' ? 'CLIENT' : 'PRODUCT';
  const range = toDateRange({ from: parameters.from, to: parameters.to });
  const result =
    segmentType === 'CLIENT' ? await profitabilityService.getClientProfitability(companyId, range) : await profitabilityService.getProductProfitability(companyId, range);

  const rows = result.rows || [];
  const sorted = [...rows].sort((a, b) => Number(b.netMargin) - Number(a.netMargin));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return {
    numericResult: { segmentType, totalIndirectCost: result.totalIndirectCost, rows },
    chartType: 'COMPOSITION',
    chartData: rows.map((r) => ({ name: r.dimensionName, value: Number(r.netMargin) })),
    causeExplanation:
      best && worst && best.dimensionId !== worst.dimensionId
        ? `"${best.dimensionName}" es el más rentable (margen neto ${best.netMarginPercent}%) mientras "${worst.dimensionName}" es el menos rentable (${worst.netMarginPercent}%) — la diferencia está en cuánto ingreso directo genera cada uno frente al costo indirecto que le toca absorber.`
        : 'No hay suficientes segmentos con movimiento en el periodo para comparar.',
    simpleInterpretation: `Te muestra qué ${segmentType === 'CLIENT' ? 'clientes' : 'productos'} realmente te dejan ganancia y cuáles te están costando dinero, después de repartir los gastos generales del negocio.`,
    methodology: `Se llamó directo al reporte de Rentabilidad de Reportes (${segmentType === 'CLIENT' ? 'getClientProfitability' : 'getProductProfitability'}), que ya reparte el costo indirecto del periodo a prorrata del ingreso directo de cada ${segmentType === 'CLIENT' ? 'cliente' : 'producto'}.`,
    recommendations:
      worst && Number(worst.netMargin) < 0
        ? [rec(`"${worst.dimensionName}" dio margen neto negativo (${worst.netMarginPercent}%) — revisa su precio o su costo antes de seguir invirtiendo ahí.`, { quantifiedType: 'PERCENTAGE', quantifiedValue: Number(worst.netMarginPercent), isPrimary: true })]
        : [rec('Ningún segmento dio margen negativo en este periodo; sigue vigilando mes a mes.')],
  };
}

// =====================================================================
// 9. BUDGET_VS_ACTUAL — REUTILIZAR (fpa/budget-variance.service)
// =====================================================================
async function runBudgetVsActual(companyId, parameters) {
  if (!parameters.budgetId) {
    throw new AppError('Indica qué presupuesto quieres comparar contra lo real.', 400, 'MISSING_BUDGET_ID');
  }
  const report = await budgetVarianceService.getBudgetVarianceReport(companyId, parameters.budgetId);
  const worst = [...report.lines].sort((a, b) => Math.abs(Number(b.variancePercentage)) - Math.abs(Number(a.variancePercentage)))[0];
  const unjustifiedCount = report.lines.filter((l) => l.requiresJustification && !l.isJustified).length;

  return {
    numericResult: { budgetId: parameters.budgetId, thresholdPercentage: report.thresholdPercentage, lines: report.lines },
    chartType: 'COMPARISON',
    chartData: report.lines.map((l) => ({ name: `${l.account.code}`, presupuestado: Number(l.budgetedAmount), real: Number(l.actualAmount) })),
    causeExplanation: worst
      ? `La cuenta "${worst.account.name}" (${worst.fpaDimension.name}) tuvo la mayor desviación: presupuestado ${worst.budgetedAmount}, real ${worst.actualAmount} (${worst.variancePercentage}%).`
      : 'El presupuesto no tiene líneas para comparar.',
    simpleInterpretation: `${unjustifiedCount > 0 ? `Hay ${unjustifiedCount} desviación(es) importante(s) sin explicar todavía.` : 'Todas las desviaciones importantes ya están explicadas.'} Compara lo que planeaste contra lo que realmente pasó, cuenta por cuenta.`,
    methodology: 'Se llamó directo al reporte de Desviaciones de FP&A (getBudgetVarianceReport), que ya compara cada línea presupuestada contra el movimiento real etiquetado con la misma dimensión.',
    recommendations:
      unjustifiedCount > 0
        ? [rec(`${unjustifiedCount} línea(s) superaron el umbral de ${report.thresholdPercentage}% y todavía no tienen justificación — revísalas antes de cerrar el periodo.`, { quantifiedType: 'NONE', isPrimary: true })]
        : [rec('No quedan desviaciones importantes sin justificar en este presupuesto.')],
  };
}

// =====================================================================
// 10. DUPONT — NUEVO
// =====================================================================
async function runDupont(companyId, parameters) {
  const [balance, income] = await Promise.all([
    sharedData.getBalanceSheetTotals(companyId, parameters.asOfDate),
    sharedData.getIncomeStatementTotals(companyId, parameters.from, parameters.to),
  ]);
  const result = calculateDupont({ netIncome: income.netIncome, revenue: income.revenue, totalAssets: balance.totalAssets, totalEquity: balance.totalEquity });

  return {
    numericResult: {
      roe: result.roe.times(100).toFixed(2),
      netProfitMargin: result.netProfitMargin.times(100).toFixed(2),
      assetTurnover: result.assetTurnover.toFixed(4),
      equityMultiplier: result.equityMultiplier.toFixed(2),
    },
    chartType: 'COMPOSITION',
    chartData: [
      { name: 'Margen Neto (%)', value: result.netProfitMargin.times(100).toNumber() },
      { name: 'Rotación de Activos', value: result.assetTurnover.toNumber() },
      { name: 'Multiplicador de Patrimonio', value: result.equityMultiplier.toNumber() },
    ],
    causeExplanation: `Tu ROE de ${result.roe.times(100).toFixed(1)}% viene de vender con un margen de ${result.netProfitMargin.times(100).toFixed(1)}%, usar tus activos ${result.assetTurnover.toFixed(2)} veces para generar ventas, y de que tus activos son ${result.equityMultiplier.toFixed(2)} veces tu patrimonio (el resto es deuda).`,
    simpleInterpretation: 'Descompone tu rentabilidad en 3 causas: qué tan bien vendes, qué tan bien usas lo que tienes, y cuánta deuda usas para financiarte — así sabes cuál de las 3 palancas mover si quieres mejorar.',
    methodology: 'ROE = Margen Neto × Rotación de Activos × Multiplicador de Patrimonio, con Utilidad Neta e Ingresos del Estado de Resultados y Activos/Patrimonio del Balance General, ambos ya calculados por Contabilidad.',
    recommendations: [
      rec(
        result.equityMultiplier.greaterThan(3)
          ? `Tu multiplicador de patrimonio (${result.equityMultiplier.toFixed(2)}) es alto — buena parte de tu rentabilidad depende de deuda, lo que también sube el riesgo si las condiciones de crédito cambian.`
          : `Tu margen neto (${result.netProfitMargin.times(100).toFixed(1)}%) es la palanca más fácil de mover con precios o control de costos.`,
        { isPrimary: true }
      ),
    ],
  };
}

// =====================================================================
// 11. TREND_ANALYSIS — NUEVO (sobre datos ya existentes)
// =====================================================================
const TREND_METRICS = {
  REVENUE: (statement) => statement.totalIncome,
  EXPENSE: (statement) => statement.totalExpense,
  NET_INCOME: (statement) => statement.netIncome,
};

async function runTrendAnalysis(companyId, parameters) {
  const metric = TREND_METRICS[parameters.metric] ? parameters.metric : 'NET_INCOME';
  const months = Math.min(24, Math.max(3, parameters.months || 6));
  const to = parameters.to ? new Date(parameters.to) : new Date();

  const points = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const monthStart = shiftMonths(new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1)), -i);
    const monthEnd = shiftMonths(monthStart, 1);

    const statement = await accountingReportsService.getIncomeStatement(companyId, { from: monthStart, to: monthEnd });
    points.push({ period: monthLabel(monthStart), value: Number(TREND_METRICS[metric](statement)) });
  }

  const stats = computeTrendStats(points);

  return {
    numericResult: {
      metric,
      average: stats.average ? stats.average.toFixed(2) : null,
      min: stats.min ? stats.min.toFixed(2) : null,
      max: stats.max ? stats.max.toFixed(2) : null,
      growthPercent: stats.growthPercent ? stats.growthPercent.toFixed(2) : null,
    },
    chartType: 'TREND_LINE',
    chartData: points,
    causeExplanation:
      stats.growthPercent === null
        ? 'No se puede calcular la variación porque el primer periodo de la serie fue cero.'
        : `${metric === 'NET_INCOME' ? 'La utilidad neta' : metric === 'REVENUE' ? 'El ingreso' : 'El gasto'} ${stats.growthPercent.greaterThanOrEqualTo(0) ? 'creció' : 'cayó'} ${stats.growthPercent.abs().toFixed(1)}% entre el primer y el último mes de la serie.`,
    simpleInterpretation: 'Muestra cómo se movió esta métrica mes a mes, para que notes si la tendencia va para arriba, para abajo, o se mantiene estable.',
    methodology: `Se pidió el Estado de Resultados de Contabilidad mes a mes durante los últimos ${months} meses y se extrajo la métrica "${metric}" de cada uno — sin recalcular nada, solo se arma la serie.`,
    recommendations:
      stats.growthPercent !== null && stats.growthPercent.lessThan(-10)
        ? [rec(`La caída de ${stats.growthPercent.abs().toFixed(1)}% en ${months} meses amerita revisar qué cambió — compáralo con un Análisis Horizontal del último mes para ver la causa puntual.`, { quantifiedType: 'PERCENTAGE', quantifiedValue: stats.growthPercent.toNumber(), isPrimary: true })]
        : [rec('La tendencia no muestra una caída fuerte; sigue revisando mes a mes.')],
  };
}

// =====================================================================
// 12. WHAT_IF_SCENARIO — REUTILIZAR (fpa/scenarios.service)
// =====================================================================
async function runWhatIfScenario(companyId, parameters) {
  const result = await scenariosService.simulateScenario(companyId, {
    ...parameters,
    baselineFrom: toDate(parameters.baselineFrom),
    baselineTo: toDate(parameters.baselineTo),
  });

  return {
    numericResult: { baseline: result.baseline, projection: result.projection },
    chartType: 'COMPARISON',
    chartData: (result.liquidity.scenarioWeeks || []).map((week, index) => ({
      semana: week.weekStart ? dateOnly(week.weekStart) : `S${index + 1}`,
      base: Number(result.liquidity.baselineWeeks?.[index]?.projectedBalance || 0),
      escenario: Number(week.scenarioProjectedBalance || 0),
    })),
    causeExplanation: `El escenario simulado cambia la utilidad mensual en ${result.projection.monthlyNetIncomeDelta} — acumulado, ${result.projection.cumulativeNetIncomeDelta} en los ${result.projection.projectionMonths} meses proyectados.`,
    simpleInterpretation: 'Simula qué pasaría con tu caja si cambias algo del negocio (más ventas, un gasto nuevo, una contratación) antes de que realmente pase.',
    methodology: 'Se llamó directo al Simulador What-If de FP&A (simulateScenario), que ya conecta con la Previsión de Liquidez real de Tesorería — este módulo no repite ese cálculo.',
    recommendations: [
      rec(
        Number(result.projection.monthlyNetIncomeDelta) < 0
          ? `Este escenario reduce tu utilidad mensual en ${Math.abs(Number(result.projection.monthlyNetIncomeDelta)).toFixed(2)} — confirma que el beneficio esperado (ej. crecimiento futuro) compensa ese costo antes de aplicarlo.`
          : `Este escenario mejora tu utilidad mensual en ${result.projection.monthlyNetIncomeDelta} — guarda el escenario para compararlo con otras opciones antes de decidir.`,
        { quantifiedType: 'AMOUNT', quantifiedValue: Math.abs(Number(result.projection.monthlyNetIncomeDelta)), isPrimary: true }
      ),
    ],
  };
}

// =====================================================================
// 13. INVESTMENT_EVALUATION — NUEVO
// =====================================================================
async function runInvestmentEvaluation(companyId, parameters) {
  if (!parameters.initialInvestment || !Array.isArray(parameters.cashFlows) || parameters.cashFlows.length === 0) {
    throw new AppError('Indica la inversión inicial y al menos un flujo de caja proyectado.', 400, 'MISSING_INVESTMENT_PARAMETERS');
  }
  const result = evaluateInvestment(parameters);

  let cumulative = new Decimal(0).minus(parameters.initialInvestment);
  const chartData = [{ period: 0, cumulative: cumulative.toNumber() }];
  parameters.cashFlows.forEach((cf, index) => {
    cumulative = cumulative.plus(cf);
    chartData.push({ period: index + 1, cumulative: cumulative.toNumber() });
  });

  return {
    numericResult: {
      npv: result.npv.toFixed(2),
      irr: result.irr ? result.irr.times(100).toFixed(2) : null,
      paybackPeriods: result.paybackPeriods ? result.paybackPeriods.toFixed(2) : null,
      isRecommended: result.isRecommended,
    },
    chartType: 'TREND_LINE',
    chartData,
    causeExplanation: result.isRecommended
      ? `El VAN es positivo (${result.npv.toFixed(2)}): los flujos futuros, descontados a hoy, superan la inversión inicial de ${parameters.initialInvestment}.`
      : `El VAN es negativo (${result.npv.toFixed(2)}): los flujos futuros, descontados a hoy, no alcanzan a cubrir la inversión inicial de ${parameters.initialInvestment}.`,
    simpleInterpretation: result.isRecommended
      ? `Esta inversión conviene: recuperas lo invertido${result.paybackPeriods ? ` en ${result.paybackPeriods.toFixed(1)} periodos` : ''} y de ahí en adelante es ganancia.`
      : 'Con los flujos proyectados, esta inversión no se recupera de forma rentable — el dinero rendiría más en otra alternativa.',
    methodology: `VAN = −Inversión Inicial + Σ (flujo del periodo ÷ (1+tasa)^periodo). TIR = la tasa que hace el VAN igual a cero (buscada por aproximación numérica). Payback = en qué periodo el flujo acumulado cubre la inversión inicial.`,
    recommendations: [
      rec(
        result.isRecommended
          ? `El VAN positivo de ${result.npv.toFixed(2)} respalda seguir adelante con la inversión, a la tasa de descuento indicada.`
          : `El VAN negativo de ${result.npv.abs().toFixed(2)} sugiere no invertir con estos flujos y esta tasa, salvo que haya un beneficio no monetario que lo justifique.`,
        { quantifiedType: 'AMOUNT', quantifiedValue: result.npv.abs().toNumber(), isPrimary: true }
      ),
    ],
  };
}

// =====================================================================
// 14. FINANCIAL_RISK_LEVERAGE — NUEVO
// =====================================================================
async function runFinancialRiskLeverage(companyId, parameters) {
  const [balance, income] = await Promise.all([
    sharedData.getBalanceSheetTotals(companyId, parameters.asOfDate),
    sharedData.getIncomeStatementTotals(companyId, parameters.from, parameters.to),
  ]);

  const operatingIncome = income.netIncome.plus(income.interestExpense);
  // Aproximación del margen de contribución con Ingresos − Costo de
  // Venta (no la clasificación fijo/variable de Punto de Equilibrio,
  // que exige que el usuario clasifique cuenta por cuenta) — suficiente
  // para un indicador de sensibilidad, documentado así en la metodología.
  const marginProxy = income.revenue.minus(income.cogs);

  let dol = null;
  let dfl = null;
  let combined = null;
  try {
    dol = calculateOperatingLeverage({ contributionMargin: marginProxy, operatingIncome });
    dfl = calculateFinancialLeverage({ operatingIncome, interestExpense: income.interestExpense });
    combined = calculateCombinedLeverage({ operatingLeverage: dol, financialLeverage: dfl });
  } catch {
    // Con utilidad operativa en cero no se puede apalancar — se documenta
    // en la explicación en vez de tumbar todo el análisis.
  }

  const fxExposureRatio = calculateFxExposureRatio({ foreignCurrencyBalance: balance.foreignCurrencyBalance, totalAssets: balance.totalAssets });

  return {
    numericResult: {
      operatingLeverage: dol ? dol.toFixed(2) : null,
      financialLeverage: dfl ? dfl.toFixed(2) : null,
      combinedLeverage: combined ? combined.toFixed(2) : null,
      fxExposureRatio: fxExposureRatio.toFixed(2),
    },
    chartType: 'COMPOSITION',
    chartData: [
      { name: 'Apalancamiento Operativo', value: dol ? dol.toNumber() : 0 },
      { name: 'Apalancamiento Financiero', value: dfl ? dfl.toNumber() : 0 },
      { name: 'Exposición a Moneda Extranjera (%)', value: fxExposureRatio.toNumber() },
    ],
    causeExplanation: fxExposureRatio.greaterThan(20)
      ? `${fxExposureRatio.toFixed(1)}% de tus activos están en moneda extranjera — un movimiento fuerte del tipo de cambio afecta directamente tu balance.`
      : `El apalancamiento combinado (${combined ? combined.toFixed(2) : 'N/D'}) mide cuánto se amplifica tu utilidad neta ante un cambio en ventas, sumando el efecto de tus costos fijos y de tu deuda.`,
    simpleInterpretation: 'Mide qué tan expuesto está tu negocio a 3 riesgos: que un cambio pequeño en ventas mueva mucho tu utilidad, que la deuda te pese más de la cuenta, o que el tipo de cambio te afecte.',
    methodology: 'Apalancamiento Operativo = Margen de Contribución ÷ Utilidad Operativa. Apalancamiento Financiero = Utilidad Operativa ÷ (Utilidad Operativa − Intereses, tomados de la deuda real vía fpa/kpis.service). Exposición FX = saldo de cuentas marcadas en moneda extranjera ÷ activos totales.',
    recommendations:
      fxExposureRatio.greaterThan(20)
        ? [rec(`Con ${fxExposureRatio.toFixed(1)}% de tus activos en moneda extranjera, considera cubrir parte de esa exposición o revisar tu política de conversión.`, { quantifiedType: 'PERCENTAGE', quantifiedValue: fxExposureRatio.toNumber(), isPrimary: true })]
        : [rec('Tu exposición cambiaria es baja; el riesgo principal a vigilar es el apalancamiento operativo y financiero combinado.')],
  };
}

// =====================================================================
// 15. BENCHMARKING — NUEVO
// =====================================================================
async function runBenchmarking(companyId, parameters) {
  if (!parameters.metricKey) {
    throw new AppError('Indica qué métrica quieres comparar contra el valor de referencia.', 400, 'MISSING_METRIC_KEY');
  }
  const benchmark = await prisma.analysisBenchmarkValue.findUnique({ where: { companyId_metricKey: { companyId, metricKey: parameters.metricKey } } });
  if (!benchmark) {
    throw new AppError('No hay un valor de referencia configurado para esa métrica todavía. Pídele al Administrador que lo agregue.', 404, 'BENCHMARK_NOT_FOUND');
  }
  if (!parameters.actualValue && parameters.actualValue !== 0) {
    throw new AppError('Indica el valor real de tu empresa para esta métrica.', 400, 'MISSING_ACTUAL_VALUE');
  }

  const result = compareToBenchmark({ actualValue: parameters.actualValue, benchmarkValue: benchmark.industryValue });

  return {
    numericResult: {
      metricKey: parameters.metricKey,
      label: benchmark.label,
      actualValue: result.actualValue.toFixed(4),
      benchmarkValue: result.benchmarkValue.toFixed(4),
      variancePercent: result.variancePercent ? result.variancePercent.toFixed(2) : null,
    },
    chartType: 'COMPARISON',
    chartData: [
      { name: 'Tu empresa', value: result.actualValue.toNumber() },
      { name: benchmark.label, value: result.benchmarkValue.toNumber() },
    ],
    causeExplanation: `Tu valor (${result.actualValue.toFixed(2)}) está ${result.isAboveBenchmark ? 'por encima' : 'por debajo'} de la referencia de industria (${result.benchmarkValue.toFixed(2)})${result.variancePercent ? `, una diferencia de ${result.variancePercent.toFixed(1)}%` : ''}.`,
    simpleInterpretation: `Compara "${benchmark.label}" contra un valor típico del sector, configurado a mano por tu Administrador — te dice si estás por encima o por debajo del promedio esperado.`,
    methodology: 'Se comparó el valor real indicado contra AnalysisBenchmarkValue (referencia manual de industria, configurada por el Administrador — no hay acceso a datos de mercado en tiempo real).',
    recommendations: [
      rec(
        result.isAboveBenchmark
          ? `Estás por encima de la referencia del sector — mantén lo que está funcionando.`
          : `Estás por debajo de la referencia del sector${result.variancePercent ? ` en ${result.variancePercent.abs().toFixed(1)}%` : ''} — revisa qué empresas similares hacen distinto.`,
        { isPrimary: true }
      ),
    ],
  };
}

// =====================================================================
// 16. PREDICTIVE_FORECAST — REUTILIZAR (treasury/liquidity-forecast.service)
// =====================================================================
async function runPredictiveForecast(companyId, parameters) {
  const weeks = parameters.weeks || 8;
  const forecast = await liquidityForecastService.getLiquidityForecast(companyId, { weeks });
  const negativeWeek = forecast.weeks.find((w) => new Decimal(w.projectedBalance).lessThan(0));

  return {
    numericResult: { startingBalance: forecast.startingBalance, weeks: forecast.weeks },
    chartType: 'TREND_LINE',
    chartData: forecast.weeks.map((w) => ({ semana: dateOnly(w.weekStart), saldoProyectado: Number(w.projectedBalance) })),
    causeExplanation: negativeWeek
      ? `El saldo proyectado se vuelve negativo en la semana del ${dateOnly(negativeWeek.weekStart)}, por las facturas y cuotas de deuda que vencen en esa fecha.`
      : `El saldo se mantiene positivo en las ${weeks} semanas proyectadas, partiendo de ${forecast.startingBalance}.`,
    simpleInterpretation: negativeWeek
      ? 'Si todo sigue la tendencia actual, tu caja se quedaría sin dinero en algún momento de las próximas semanas — hay que actuar antes de que llegue esa fecha.'
      : 'Si todo sigue la tendencia actual, tu caja se mantiene con saldo positivo en las próximas semanas.',
    methodology: 'Se llamó directo a la Previsión de Liquidez de Tesorería (getLiquidityForecast), que ya proyecta semana a semana con facturas de clientes/proveedores, cuotas de deuda y órdenes de pago reales — este módulo no repite ese cálculo.',
    recommendations: negativeWeek
      ? [rec(`Prepárate para la semana del ${dateOnly(negativeWeek.weekStart)}: negocia plazos, adelanta cobros o consigue una línea de crédito de respaldo antes de esa fecha.`, { isPrimary: true })]
      : [rec('Tu proyección de caja luce estable; vuelve a correr este análisis cada semana para detectar cambios a tiempo.')],
  };
}

const HANDLERS = {
  VERTICAL: runVertical,
  HORIZONTAL: runHorizontal,
  FINANCIAL_RATIOS: runFinancialRatios,
  CASH_FLOW: runCashFlow,
  BREAK_EVEN: runBreakEven,
  CVU: runCvu,
  WORKING_CAPITAL: runWorkingCapital,
  PROFITABILITY_SEGMENT: runProfitabilitySegment,
  BUDGET_VS_ACTUAL: runBudgetVsActual,
  DUPONT: runDupont,
  TREND_ANALYSIS: runTrendAnalysis,
  WHAT_IF_SCENARIO: runWhatIfScenario,
  INVESTMENT_EVALUATION: runInvestmentEvaluation,
  FINANCIAL_RISK_LEVERAGE: runFinancialRiskLeverage,
  BENCHMARKING: runBenchmarking,
  PREDICTIVE_FORECAST: runPredictiveForecast,
};

module.exports = { HANDLERS };
