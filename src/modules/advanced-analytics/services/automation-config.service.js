const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const { getCatalogEntry } = require('./analysis-catalog');

async function listConfigs(companyId) {
  return prisma.analysisAutomationConfig.findMany({ where: { companyId }, orderBy: { analysisType: 'asc' } });
}

async function upsertConfig(companyId, userId, analysisType, { isEnabled, frequency, defaultParameters, alertCondition }) {
  if (!getCatalogEntry(analysisType)) {
    throw new AppError(`"${analysisType}" no es un tipo de análisis válido.`, 400, 'INVALID_ANALYSIS_TYPE');
  }
  if (isEnabled && !frequency) {
    throw new AppError('Indica cada cuánto debe correr este análisis (diario, semanal o mensual) para automatizarlo.', 400, 'MISSING_FREQUENCY');
  }

  return prisma.analysisAutomationConfig.upsert({
    where: { companyId_analysisType: { companyId, analysisType } },
    create: {
      companyId,
      analysisType,
      isEnabled: !!isEnabled,
      frequency: frequency || null,
      defaultParameters: defaultParameters || undefined,
      alertCondition: alertCondition || undefined,
      updatedByUserId: userId,
    },
    update: {
      isEnabled: !!isEnabled,
      frequency: frequency || null,
      defaultParameters: defaultParameters === undefined ? undefined : defaultParameters,
      alertCondition: alertCondition === undefined ? undefined : alertCondition,
      updatedByUserId: userId,
    },
  });
}

module.exports = { listConfigs, upsertConfig };
