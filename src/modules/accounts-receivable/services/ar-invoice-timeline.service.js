// Línea de tiempo de una factura: se alimenta SIEMPRE de las filas
// reales de AuditLog (core/audit), nunca de un cálculo aparte — solo
// se usan las tablas de negocio para saber QUÉ otras entidades
// auditadas (cobros, notas de crédito/débito) participaron en el ciclo
// de vida de esta factura en particular.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { buildInvoiceTimelineSteps, computeFirstActionGapDays, detectUnusualDelay } = require('./ar-invoice-timeline.rules');

async function loadInvoiceWithRelations(companyId, invoiceId) {
  const invoice = await prisma.arInvoice.findFirst({
    where: { id: invoiceId, companyId },
    include: { paymentApplications: true, creditNotes: true },
  });
  if (!invoice) {
    throw new AppError('La factura indicada no existe.', 404, 'INVOICE_NOT_FOUND');
  }
  return invoice;
}

async function buildStepsForInvoice(companyId, invoice) {
  const paymentIds = invoice.paymentApplications.map((pa) => pa.paymentId);
  const creditNoteIds = invoice.creditNotes.map((cn) => cn.id);

  const refs = [
    { entityType: 'ArInvoice', entityId: invoice.id },
    ...paymentIds.map((id) => ({ entityType: 'ArPayment', entityId: id })),
    ...creditNoteIds.map((id) => ({ entityType: 'ArCreditNote', entityId: id })),
  ];
  const entries = await auditService.listForEntities(companyId, refs);

  const paymentApplicationsByPaymentId = Object.fromEntries(
    invoice.paymentApplications.map((pa) => [pa.paymentId, { amount: pa.amount.toFixed(2) }])
  );
  const creditNotesById = Object.fromEntries(invoice.creditNotes.map((cn) => [cn.id, cn]));

  return buildInvoiceTimelineSteps(entries, { paymentApplicationsByPaymentId, creditNotesById });
}

// Historial de "días hasta el primer movimiento" de las demás facturas
// del mismo cliente — solo lectura, para comparar el gap de la factura
// actual contra un promedio real (innovación pedida explícitamente).
async function getHistoricalFirstActionGaps(companyId, customerId, excludeInvoiceId) {
  const otherInvoices = await prisma.arInvoice.findMany({
    where: { companyId, customerId, id: { not: excludeInvoiceId } },
    include: { paymentApplications: true, creditNotes: true },
    take: 30,
    orderBy: { issueDate: 'desc' },
  });

  const gaps = [];
  for (const inv of otherInvoices) {

    const steps = await buildStepsForInvoice(companyId, inv);
    gaps.push(computeFirstActionGapDays(steps));
  }
  return gaps;
}

async function getInvoiceTimeline(companyId, invoiceId) {
  const invoice = await loadInvoiceWithRelations(companyId, invoiceId);
  const steps = await buildStepsForInvoice(companyId, invoice);

  const currentGapDays = computeFirstActionGapDays(steps);
  const historicalGaps = await getHistoricalFirstActionGaps(companyId, invoice.customerId, invoice.id);
  const anomaly = detectUnusualDelay(currentGapDays, historicalGaps);

  return {
    steps,
    firstActionGapDays: currentGapDays,
    anomaly: anomaly.isAnomaly
      ? { onStepIndex: 1, averageDays: Math.round(anomaly.averageDays * 10) / 10 }
      : null,
  };
}

module.exports = { getInvoiceTimeline };
