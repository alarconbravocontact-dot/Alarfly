// Corre los análisis configurados como automáticos: revisa qué
// configuraciones están habilitadas y a cuáles ya les toca (isDue), las
// ejecuta vía el mismo motor que usa el modo manual (nunca un cálculo
// aparte), archiva el reporte, dispara una alerta si el resultado
// cruza la condición configurada, y deja constancia en core/audit.
const prisma = require('../../../core/database/prisma');
const { isDue } = require('../../../core/utils/schedulingRules');
const { evaluateCondition } = require('../../../core/utils/conditionEvaluator');
const auditService = require('../../../core/audit/audit.service');
const alertsService = require('../../../core/alerts/alerts.service');
const analysisEngine = require('./analysis-engine.service');
const { getCatalogEntry } = require('./analysis-catalog');

async function runDueAutomations(companyId, systemUserId) {
  const now = new Date();
  const configs = await prisma.analysisAutomationConfig.findMany({ where: { companyId, isEnabled: true } });
  const results = [];

  for (const config of configs) {
    if (!isDue(config.frequency, config.lastRunAt, now)) continue;

    try {

      const report = await analysisEngine.runAnalysis(companyId, config.analysisType, config.defaultParameters || {}, {
        triggerSource: 'AUTOMATIC',
        triggeredByUserId: null,
      });


      await prisma.analysisAutomationConfig.update({ where: { id: config.id }, data: { lastRunAt: now } });


      await auditService.log({
        companyId,
        userId: systemUserId,
        action: 'advanced_analysis.auto_run',
        entityType: 'AnalysisReport',
        entityId: report.id,
        oldValue: null,
        newValue: { analysisType: config.analysisType, triggerSource: 'AUTOMATIC' },
      });

      let alert = null;
      if (config.alertCondition) {
        const context = flattenForCondition(report.numericResult);
        let matches = false;
        try {
          matches = evaluateCondition(config.alertCondition, context);
        } catch (conditionError) {
          console.error(`Condición de alerta inválida en AnalysisAutomationConfig ${config.id}:`, conditionError.message);
        }
        if (matches) {
          const catalogEntry = getCatalogEntry(config.analysisType);

          alert = await alertsService.createAlertIfNotExists({
            companyId,
            ruleId: null,
            type: 'ADVANCED_ANALYSIS_ALERT',
            severity: 'WARNING',
            message: `El análisis automático "${catalogEntry ? catalogEntry.label : config.analysisType}" cruzó la condición configurada.`,
            entityType: 'AnalysisReport',
            entityId: report.id,
          });
          if (alert) {

            await prisma.analysisReport.update({ where: { id: report.id }, data: { generatedAlertId: alert.id } });
          }
        }
      }

      results.push({ analysisType: config.analysisType, reportId: report.id, alertId: alert ? alert.id : null });
    } catch (error) {
      console.error(`Error corriendo el análisis automático "${config.analysisType}" de la empresa ${companyId}:`, error.message);
    }
  }

  return results;
}

// El árbol de condiciones espera un objeto plano {campo: valor} — el
// numericResult de cada análisis ya es un objeto (a veces con
// sub-objetos anidados, ej. Razones Financieras); acá se aplana un
// nivel para que una condición pueda referenciar campos anidados con
// notación "grupo.campo" sin que el usuario tenga que saber la forma
// exacta de cada tipo de análisis de memoria.
function flattenForCondition(numericResult, prefix = '', target = {}) {
  if (numericResult === null || typeof numericResult !== 'object' || Array.isArray(numericResult)) {
    if (prefix) target[prefix] = numericResult;
    return target;
  }
  for (const [key, value] of Object.entries(numericResult)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenForCondition(value, path, target);
    } else {
      target[path] = value;
    }
  }
  return target;
}

module.exports = { runDueAutomations, flattenForCondition };
