// Motor de Análisis: el único lugar que sabe ejecutar cualquiera de los
// 16 tipos de Análisis Avanzados, armar las 6 partes obligatorias, y
// archivar el resultado. Ni este servicio ni los handlers que llama
// escriben nunca en otro módulo — todo es lectura.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const { HANDLERS } = require('./analysis-handlers');
const { getCatalogEntry } = require('./analysis-catalog');

const VALID_CHART_TYPES = ['TREND_LINE', 'COMPOSITION', 'COMPARISON'];

// Valida que un resultado de handler cumpla el contrato de 6 partes —
// nunca se archiva (ni se automatiza) un reporte con una parte vacía o
// nula, tal como lo exige el módulo.
function assertSixPartContract(analysisType, result) {
  const fail = (reason) => {
    throw new AppError(`El análisis "${analysisType}" no devolvió un resultado completo: ${reason}.`, 500, 'INCOMPLETE_ANALYSIS_RESULT');
  };

  if (!result || typeof result !== 'object') fail('el resultado está vacío');
  if (result.numericResult === null || result.numericResult === undefined) fail('falta el resultado numérico');
  if (!VALID_CHART_TYPES.includes(result.chartType)) fail('el tipo de gráfico no es válido');
  if (!Array.isArray(result.chartData) || result.chartData.length === 0) fail('falta la serie de datos para el gráfico');
  if (!result.causeExplanation || typeof result.causeExplanation !== 'string') fail('falta la explicación de la causa');
  if (!result.simpleInterpretation || typeof result.simpleInterpretation !== 'string') fail('falta la interpretación simple');
  if (!result.methodology || typeof result.methodology !== 'string') fail('falta la metodología');
  if (!Array.isArray(result.recommendations) || result.recommendations.length === 0) fail('faltan las sugerencias');
}

// Ejecuta un análisis (manual o automático) y archiva el reporte
// resultante. `triggeredByUserId` es null cuando lo dispara el cron.
async function runAnalysis(companyId, analysisType, parameters, { triggerSource, triggeredByUserId = null } = {}) {
  const catalogEntry = getCatalogEntry(analysisType);
  if (!catalogEntry) {
    throw new AppError(`"${analysisType}" no es un tipo de análisis válido.`, 400, 'INVALID_ANALYSIS_TYPE');
  }
  const handler = HANDLERS[analysisType];
  if (!handler) {
    throw new AppError(`El análisis "${analysisType}" todavía no tiene un motor de cálculo conectado.`, 501, 'ANALYSIS_NOT_IMPLEMENTED');
  }

  const result = await handler(companyId, parameters || {});
  assertSixPartContract(analysisType, result);

  const report = await prisma.analysisReport.create({
    data: {
      companyId,
      analysisType,
      triggerSource,
      triggeredByUserId,
      parameters: parameters || {},
      numericResult: result.numericResult,
      chartType: result.chartType,
      chartData: result.chartData,
      causeExplanation: result.causeExplanation,
      simpleInterpretation: result.simpleInterpretation,
      methodology: result.methodology,
      recommendations: result.recommendations,
    },
  });

  return report;
}

module.exports = { runAnalysis, assertSixPartContract, VALID_CHART_TYPES };
