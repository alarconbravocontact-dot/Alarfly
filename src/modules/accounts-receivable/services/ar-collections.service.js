// Cobranza Automatizada por Niveles de Severidad. Reutiliza el motor
// de alertas de Tesorería (core/alerts) — mismo mecanismo que ya usan
// Tesorería/Fiscal/Inventario, solo se agrega un tipo de alerta nuevo
// (AR_COLLECTION_ESCALATION) y esta función de escaneo. Los 3 niveles
// calzan con los 3 valores que ya existen en AlertSeverity
// (INFO/WARNING/CRITICAL). El nivel crítico, además de la alerta,
// bloquea al cliente automáticamente (misma función que el bloqueo
// manual de customers.service, no se duplica esa lógica).
const prisma = require('../../../core/database/prisma');
const coreAlertsService = require('../../../core/alerts/alerts.service');
const { daysUntil } = require('../../../core/alerts/alerts.rules');
const customersService = require('./customers.service');
const { resolveEscalationLevel } = require('./ar-collections.rules');

// Niveles por defecto si la regla no trae los suyos en `parameters.levels`.
const DEFAULT_LEVELS = [
  { daysOverdue: 7, severity: 'INFO', action: 'REMINDER' },
  { daysOverdue: 15, severity: 'WARNING', action: 'FIRM_NOTICE' },
  { daysOverdue: 30, severity: 'CRITICAL', action: 'BLOCK' },
];

const ACTION_MESSAGES = {
  REMINDER: (customerName, invoiceNumber, daysOverdue) =>
    `Recordatorio: la factura ${invoiceNumber} de "${customerName}" está vencida hace ${daysOverdue} días.`,
  FIRM_NOTICE: (customerName, invoiceNumber, daysOverdue) =>
    `Aviso firme: la factura ${invoiceNumber} de "${customerName}" lleva ${daysOverdue} días vencida — requiere seguimiento urgente.`,
  BLOCK: (customerName, invoiceNumber, daysOverdue) =>
    `Bloqueo automático: la factura ${invoiceNumber} de "${customerName}" lleva ${daysOverdue} días vencida — el cliente quedó bloqueado para nuevas facturas.`,
};

async function scanOverdueInvoices(companyId, userId) {
  const rule = await prisma.alertRule.findFirst({ where: { companyId, type: 'AR_COLLECTION_ESCALATION', isActive: true } });
  if (!rule) return [];

  const levels = Array.isArray(rule.parameters?.levels) && rule.parameters.levels.length > 0 ? rule.parameters.levels : DEFAULT_LEVELS;
  const today = new Date();

  const overdueInvoices = await prisma.arInvoice.findMany({
    where: { companyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: today } },
    include: { customer: true },
  });

  const created = [];
  for (const invoice of overdueInvoices) {
    const daysOverdue = -daysUntil(invoice.dueDate, today);
    const level = resolveEscalationLevel(daysOverdue, levels);
    if (!level) continue;

    const messageBuilder = ACTION_MESSAGES[level.action];
    const message = messageBuilder
      ? messageBuilder(invoice.customer.name, invoice.invoiceNumber, daysOverdue)
      : `La factura ${invoice.invoiceNumber} de "${invoice.customer.name}" está vencida hace ${daysOverdue} días.`;

    // Cada nivel deja su propia alerta (entityId compuesto) — así la
    // escalada queda visible como un historial (recordatorio, luego
    // aviso firme, luego bloqueo), en vez de que el primer aviso
    // "tape" a los siguientes por la regla de no duplicar activas.
    const alert = await coreAlertsService.createAlertIfNotExists({
      companyId,
      ruleId: rule.id,
      type: 'AR_COLLECTION_ESCALATION',
      severity: level.severity,
      message,
      entityType: 'ArInvoice',
      entityId: `${invoice.id}:${level.action}`,
    });
    if (alert) created.push(alert);

    if (level.action === 'BLOCK' && !invoice.customer.isBlocked) {
      await customersService.blockCustomer(
        companyId,
        invoice.customer.id,
        userId,
        `Cobranza automática: factura ${invoice.invoiceNumber} vencida hace ${daysOverdue} días.`
      );
    }
  }

  return created;
}

module.exports = { scanOverdueInvoices };
