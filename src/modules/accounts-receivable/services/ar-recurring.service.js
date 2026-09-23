// Plantillas de recurrencia automática (acción "Duplicar" de una
// factura, la innovación pedida explícitamente por el usuario): en vez
// de que alguien duplique manualmente cada mes una factura con el
// mismo cliente y monto, se sugiere activar una plantilla que vuelve a
// llamar al MISMO `ar-invoices.service.createInvoice` que ya usa la
// creación manual — nunca escribe una `ArInvoice` directo, ni
// recalcula impuesto/retención por su cuenta.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { isDue } = require('../../../core/utils/schedulingRules');
const { detectRecurringPattern } = require('./ar-recurring.rules');
const arInvoicesService = require('./ar-invoices.service');

// Revisa si la factura indicada (la que el usuario está por duplicar)
// forma parte de un patrón mensual real con el mismo cliente — solo
// lectura, no crea ni sugiere nada por sí sola, la pantalla decide qué
// mostrar con el resultado.
async function checkRecurrence(companyId, invoiceId) {
  const invoice = await prisma.arInvoice.findFirst({ where: { id: invoiceId, companyId } });
  if (!invoice) {
    throw new AppError('La factura indicada no existe.', 404, 'INVOICE_NOT_FOUND');
  }

  const sameCustomerInvoices = await prisma.arInvoice.findMany({
    where: { companyId, customerId: invoice.customerId, id: { not: invoice.id } },
    select: { id: true, totalAmount: true, issueDate: true },
  });

  return detectRecurringPattern(invoice, sameCustomerInvoices);
}

async function createTemplate(companyId, userId, data) {
  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId, isActive: true } });
  if (!customer) {
    throw new AppError('El cliente indicado no existe o está inactivo.', 404, 'CUSTOMER_NOT_FOUND');
  }
  if (!Array.isArray(data.linesSnapshot) || data.linesSnapshot.length === 0) {
    throw new AppError('La plantilla necesita al menos una línea.', 400, 'TEMPLATE_LINES_REQUIRED');
  }

  const template = await prisma.arRecurringInvoiceTemplate.create({
    data: {
      companyId,
      customerId: data.customerId,
      jurisdictionId: data.jurisdictionId,
      incomeAccountId: data.incomeAccountId,
      taxRateId: data.taxRateId || null,
      withholdingRateId: data.withholdingRateId || null,
      linesSnapshot: data.linesSnapshot,
      createdByUserId: userId,
    },
    include: { customer: true },
  });

  await auditService.log({
    companyId,
    userId,
    action: 'ar_recurring_template.created',
    entityType: 'ArRecurringInvoiceTemplate',
    entityId: template.id,
    oldValue: null,
    newValue: template,
  });

  return template;
}

async function listTemplates(companyId) {
  return prisma.arRecurringInvoiceTemplate.findMany({
    where: { companyId },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function deactivateTemplate(companyId, id, userId) {
  const template = await prisma.arRecurringInvoiceTemplate.findFirst({ where: { id, companyId } });
  if (!template) {
    throw new AppError('La plantilla indicada no existe.', 404, 'TEMPLATE_NOT_FOUND');
  }

  const updated = await prisma.arRecurringInvoiceTemplate.update({ where: { id }, data: { isActive: false } });

  await auditService.log({
    companyId,
    userId,
    action: 'ar_recurring_template.deactivated',
    entityType: 'ArRecurringInvoiceTemplate',
    entityId: id,
    oldValue: template,
    newValue: updated,
  });

  return updated;
}

// Genera la factura de una plantilla vencida llamando al mismo flujo
// real de creación manual — se atribuye a quien creó la plantilla (el
// usuario que decidió activar la recurrencia), no a un "primer
// Administrador" genérico, porque acá sí se sabe con certeza quién es
// el responsable de la automatización.
async function generateFromTemplate(template) {
  const invoice = await arInvoicesService.createInvoice(template.companyId, template.createdByUserId, {
    customerId: template.customerId,
    jurisdictionId: template.jurisdictionId,
    incomeAccountId: template.incomeAccountId,
    issueDate: new Date(),
    taxRateId: template.taxRateId || undefined,
    withholdingRateId: template.withholdingRateId || undefined,
    lines: template.linesSnapshot,
  });

  await prisma.arRecurringInvoiceTemplate.update({ where: { id: template.id }, data: { lastGeneratedAt: new Date() } });

  await auditService.log({
    companyId: template.companyId,
    userId: template.createdByUserId,
    action: 'ar_recurring_template.auto_generated',
    entityType: 'ArInvoice',
    entityId: invoice.id,
    oldValue: null,
    newValue: { templateId: template.id, invoiceId: invoice.id },
  });

  return invoice;
}

// Punto de entrada del cron: revisa las plantillas activas de una
// empresa y genera la factura de cada una a la que ya le toca (mismo
// evaluador `isDue` que ya usan ScheduledReport y
// AnalysisAutomationConfig) — siempre MONTHLY, no hay otra frecuencia
// pedida para esta pieza. Una plantilla que falle no bloquea a las
// demás.
async function runDueTemplates(companyId) {
  const templates = await prisma.arRecurringInvoiceTemplate.findMany({ where: { companyId, isActive: true } });
  const now = new Date();
  const results = [];

  for (const template of templates) {
    if (!isDue('MONTHLY', template.lastGeneratedAt, now)) continue;
    try {

      const invoice = await generateFromTemplate(template);
      results.push({ templateId: template.id, invoiceId: invoice.id });
    } catch (error) {
      console.error(`Error generando la factura recurrente de la plantilla ${template.id}:`, error.message);
    }
  }

  return results;
}

module.exports = { checkRecurrence, createTemplate, listTemplates, deactivateTemplate, generateFromTemplate, runDueTemplates };
