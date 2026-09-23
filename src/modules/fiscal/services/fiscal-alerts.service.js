const prisma = require('../../../core/database/prisma');
const coreAlertsService = require('../../../core/alerts/alerts.service');
const { detectDueSoon, severityForDueSoon } = require('../../../core/alerts/alerts.rules');
const { calculateNextDueDate } = require('./fiscal-obligations.rules');

// Reutiliza el motor de alertas ya creado (ahora en core/alerts, del
// que también depende Tesorería) — no se crea ninguna tabla ni lógica
// de "no duplicar una alerta activa" nueva.
async function scanFiscalObligations(companyId) {
  const rule = await prisma.alertRule.findFirst({ where: { companyId, type: 'FISCAL_OBLIGATION_DUE', isActive: true } });
  if (!rule) return [];
  const daysBefore = rule.parameters?.daysBefore ?? 5;
  const today = new Date();

  const obligations = await prisma.fiscalObligation.findMany({ where: { companyId, isActive: true } });
  const created = [];

  for (const obligation of obligations) {
    const nextDueDate = calculateNextDueDate(obligation, today);
    if (!detectDueSoon(nextDueDate, today, daysBefore)) continue;

    const alert = await coreAlertsService.createAlertIfNotExists({
      companyId,
      ruleId: rule.id,
      type: 'FISCAL_OBLIGATION_DUE',
      severity: severityForDueSoon(nextDueDate, today),
      message: `La obligación fiscal "${obligation.name}" vence el ${nextDueDate.toISOString().slice(0, 10)}.`,
      entityType: 'FiscalObligation',
      entityId: obligation.id,
    });
    if (alert) created.push(alert);
  }

  return created;
}

module.exports = { scanFiscalObligations };
