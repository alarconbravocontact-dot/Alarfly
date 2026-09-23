// Espejo exacto de accounts-receivable/services/ar-invoices.service.js
// del lado de facturas de compra (Purchase).
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const fiscalTransactionsService = require('../../fiscal/services/fiscal-transactions.service');
const { calculateDueDate } = require('./ap-bills.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');

const { Decimal } = Prisma;

async function createBill(companyId, userId, data) {
  const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, companyId, isActive: true } });
  if (!vendor) {
    throw new AppError('El proveedor indicado no existe o está inactivo.', 404, 'VENDOR_NOT_FOUND');
  }

  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new AppError('La factura necesita al menos una línea.', 400, 'BILL_LINES_REQUIRED');
  }

  const payableGlAccountId = await arApSettingsService.assertPayableAccountConfigured(companyId);

  const lines = data.lines.map((line, index) => {
    const quantity = new Decimal(line.quantity ?? 1);
    const unitPrice = new Decimal(line.unitPrice);
    return { description: line.description, quantity, unitPrice, amount: quantity.times(unitPrice), order: index };
  });
  const subtotal = lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));

  const issueDate = new Date(data.issueDate);
  const dueDate = calculateDueDate(issueDate, vendor.paymentTermsDays);

  // Fase 1: igual que en AR, Fiscal + Ledger + factura quedan en una
  // sola transacción.
  return withTransaction(async (tx) => {
    const fiscalTransaction = await fiscalTransactionsService.createFiscalTransaction(
      companyId,
      userId,
      {
        type: 'PURCHASE',
        jurisdictionId: data.jurisdictionId,
        date: issueDate,
        taxBase: subtotal,
        taxBaseAccountId: data.expenseAccountId,
        counterpartyAccountId: payableGlAccountId,
        counterpartyName: vendor.name,
        counterpartyTaxId: vendor.taxId || '',
        documentNumber: data.documentNumber || null,
        description: `Factura de compra — ${vendor.name}`,
        taxRateId: data.taxRateId,
        withholdingRateId: data.withholdingRateId,
      },
      tx
    );

    const billNumber = await arApSettingsService.getNextApBillNumber(companyId, tx);
    const totalAmount = subtotal.plus(fiscalTransaction.taxAmount).minus(fiscalTransaction.withholdingAmount);

    const bill = await tx.apBill.create({
      data: {
        companyId,
        vendorId: vendor.id,
        billNumber,
        issueDate,
        dueDate,
        jurisdictionId: data.jurisdictionId,
        expenseAccountId: data.expenseAccountId,
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
      { companyId, userId, action: 'ap_bill.created', entityType: 'ApBill', entityId: bill.id, oldValue: null, newValue: bill },
      tx
    );

    return bill;
  });
}

async function getBill(companyId, id) {
  const bill = await prisma.apBill.findFirst({
    where: { id, companyId },
    include: { lines: true, vendor: true, fiscalTransaction: true, paymentApplications: { include: { payment: true } } },
  });
  if (!bill) {
    throw new AppError('La factura indicada no existe.', 404, 'BILL_NOT_FOUND');
  }
  return bill;
}

async function listBills(companyId, { vendorId, status, from, to } = {}) {
  return prisma.apBill.findMany({
    where: {
      companyId,
      vendorId: vendorId || undefined,
      status: status || undefined,
      issueDate: from || to ? { gte: from, lte: to } : undefined,
    },
    include: { vendor: true },
    orderBy: { issueDate: 'desc' },
  });
}

module.exports = { createBill, getBill, listBills };
