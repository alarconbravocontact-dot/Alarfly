// Facturas de venta. Reutiliza el motor fiscal ya existente
// (fiscal/services/fiscal-transactions.service) para calcular
// impuesto/retención, correr las validaciones preventivas y postear el
// asiento vía core/ledger — este servicio NUNCA vuelve a calcular
// impuestos ni escribe JournalEntry directo, solo agrega encima lo que
// Fiscal no tenía: cliente real, fecha de vencimiento y seguimiento de
// cobro.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const fiscalTransactionsService = require('../../fiscal/services/fiscal-transactions.service');
const taxRatesService = require('../../fiscal/services/tax-rates.service');
const { daysUntil } = require('../../../core/alerts/alerts.rules');
const { calculateDueDate, assertCustomerCreditOk, buildSalesTrend } = require('./ar-invoices.rules');

const { Decimal } = Prisma;

// Saldo pendiente actual del cliente y su factura abierta más
// atrasada — solo lectura, se usa para validar crédito antes de
// facturar (punto 2). No duplica `determineInvoiceStatus`: consulta
// directo lo que AR ya guarda por factura.
async function getCustomerCreditSnapshot(companyId, customerId) {
  const openInvoices = await prisma.arInvoice.findMany({
    where: { companyId, customerId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
    select: { totalAmount: true, paidAmount: true, dueDate: true },
  });

  const today = new Date();
  let currentOpenBalance = new Decimal(0);
  let maxDaysOverdueFound = 0;

  for (const invoice of openInvoices) {
    currentOpenBalance = currentOpenBalance.plus(new Decimal(invoice.totalAmount).minus(invoice.paidAmount));
    const overdueDays = -daysUntil(invoice.dueDate, today);
    if (overdueDays > maxDaysOverdueFound) maxDaysOverdueFound = overdueDays;
  }

  return { currentOpenBalance, maxDaysOverdueFound };
}

async function createInvoice(companyId, userId, data) {
  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId, isActive: true } });
  if (!customer) {
    throw new AppError('El cliente indicado no existe o está inactivo.', 404, 'CUSTOMER_NOT_FOUND');
  }

  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new AppError('La factura necesita al menos una línea.', 400, 'INVOICE_LINES_REQUIRED');
  }

  const receivableGlAccountId = await arApSettingsService.assertReceivableAccountConfigured(companyId);

  const lines = data.lines.map((line, index) => {
    const quantity = new Decimal(line.quantity ?? 1);
    const unitPrice = new Decimal(line.unitPrice);
    return { description: line.description, quantity, unitPrice, amount: quantity.times(unitPrice), order: index };
  });
  const subtotal = lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));

  const issueDate = new Date(data.issueDate);
  const dueDate = calculateDueDate(issueDate, customer.paymentTermsDays);

  // Punto 2: límite de crédito y bloqueo por atraso — se valida ANTES
  // de tocar Fiscal, para no dejar nada a medias si se rechaza. Se
  // estima el total (subtotal + impuesto - retención) resolviendo la
  // MISMA tasa que va a usar el motor fiscal, sin volver a calcular
  // nada distinto — Fiscal la vuelve a resolver al postear, es una
  // lectura sin efectos secundarios, no una duplicación de lógica.
  const { currentOpenBalance, maxDaysOverdueFound } = await getCustomerCreditSnapshot(companyId, customer.id);
  let estimatedTotal = subtotal;
  if (!data.taxRateId || !data.withholdingRateId) {
    const { taxRate, withholdingRate } = await taxRatesService.resolveApplicableTax(companyId, {
      jurisdictionId: data.jurisdictionId,
      transactionType: 'SALE',
      date: issueDate,
    });
    const estimatedTax = taxRate ? subtotal.times(taxRate.rate).dividedBy(100) : new Decimal(0);
    const estimatedWithholding = withholdingRate ? subtotal.times(withholdingRate.rate).dividedBy(100) : new Decimal(0);
    estimatedTotal = subtotal.plus(estimatedTax).minus(estimatedWithholding);
  }
  assertCustomerCreditOk({
    customer,
    currentOpenBalance,
    newInvoiceAmount: estimatedTotal,
    maxDaysOverdueFound,
  });

  // Punto de integración con Fiscal: la misma pieza que ya calcula
  // impuesto/retención, corre las validaciones preventivas y postea el
  // asiento balanceado — no se duplica nada de eso acá.
  const fiscalTransaction = await fiscalTransactionsService.createFiscalTransaction(companyId, userId, {
    type: 'SALE',
    jurisdictionId: data.jurisdictionId,
    date: issueDate,
    taxBase: subtotal,
    taxBaseAccountId: data.incomeAccountId,
    counterpartyAccountId: receivableGlAccountId,
    counterpartyName: customer.name,
    counterpartyTaxId: customer.taxId || '',
    documentNumber: data.documentNumber || null,
    description: `Factura de venta — ${customer.name}`,
    taxRateId: data.taxRateId,
    withholdingRateId: data.withholdingRateId,
  });

  const invoiceNumber = await arApSettingsService.getNextArInvoiceNumber(companyId);
  const totalAmount = subtotal.plus(fiscalTransaction.taxAmount).minus(fiscalTransaction.withholdingAmount);

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.arInvoice.create({
      data: {
        companyId,
        customerId: customer.id,
        invoiceNumber,
        issueDate,
        dueDate,
        jurisdictionId: data.jurisdictionId,
        incomeAccountId: data.incomeAccountId,
        fiscalTransactionId: fiscalTransaction.id,
        subtotal,
        taxAmount: fiscalTransaction.taxAmount,
        withholdingAmount: fiscalTransaction.withholdingAmount,
        totalAmount,
        createdByUserId: userId,
        lines: {
          create: lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            amount: line.amount,
            order: line.order,
          })),
        },
      },
      include: { lines: true },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'ar_invoice.created',
        entityType: 'ArInvoice',
        entityId: invoice.id,
        oldValue: null,
        newValue: invoice,
      },
      tx
    );

    return invoice;
  });
}

async function getInvoice(companyId, id) {
  const invoice = await prisma.arInvoice.findFirst({
    where: { id, companyId },
    include: { lines: true, customer: true, fiscalTransaction: true, paymentApplications: { include: { payment: true } } },
  });
  if (!invoice) {
    throw new AppError('La factura indicada no existe.', 404, 'INVOICE_NOT_FOUND');
  }
  return invoice;
}

async function listInvoices(companyId, { customerId, status, from, to } = {}) {
  return prisma.arInvoice.findMany({
    where: {
      companyId,
      customerId: customerId || undefined,
      status: status || undefined,
      issueDate: from || to ? { gte: from, lte: to } : undefined,
    },
    include: { customer: true },
    orderBy: { issueDate: 'desc' },
  });
}

// Comportamiento de ventas para el gráfico del Panel principal: total
// facturado y cantidad de facturas por mes, sobre los últimos `months`
// meses. Es una agregación de solo lectura sobre lo que AR ya guarda
// (mismo criterio que usa el Panel principal con el Estado de
// Resultados de Contabilidad para el gráfico de ingresos/egresos) — no
// recalcula ni duplica nada de lo que ya hace `createInvoice`.
async function getSalesTrend(companyId, { months = 6 } = {}) {
  const referenceDate = new Date();
  const rangeStart = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - (months - 1), 1));

  const invoices = await prisma.arInvoice.findMany({
    where: { companyId, issueDate: { gte: rangeStart } },
    select: { issueDate: true, totalAmount: true },
  });

  return buildSalesTrend(invoices, months, referenceDate);
}

module.exports = { createInvoice, getInvoice, listInvoices, getSalesTrend };
