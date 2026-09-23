// Pagos a proveedores, aplicados a una o varias facturas. Postea
// directo vía core/ledger (débito la cuenta de Cuentas por Pagar,
// crédito la cuenta de efectivo de la TreasuryAccount elegida).
// Pendiente documentado: conectar esto con el flujo de aprobación
// multinivel de Tesorería (PaymentOrder) queda para una siguiente
// pasada — por ahora es un pago directo, sin maker-checker.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const { applyPaymentToBills } = require('./ap-bills.rules');

const { Decimal } = Prisma;

async function recordPayment(companyId, userId, data) {
  const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, companyId } });
  if (!vendor) {
    throw new AppError('El proveedor indicado no existe.', 404, 'VENDOR_NOT_FOUND');
  }

  const treasuryAccount = await prisma.treasuryAccount.findFirst({ where: { id: data.treasuryAccountId, companyId } });
  if (!treasuryAccount) {
    throw new AppError('La cuenta de Tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }

  const payableGlAccountId = await arApSettingsService.assertPayableAccountConfigured(companyId);

  const billIds = data.applications.map((application) => application.billId);
  const bills = await prisma.apBill.findMany({ where: { id: { in: billIds }, companyId, vendorId: vendor.id } });
  const billsById = new Map(bills.map((bill) => [bill.id, bill]));

  const amount = new Decimal(data.amount);
  const applicationResults = applyPaymentToBills(amount, data.applications, billsById);

  const entry = await ledgerService.postEntry({
    companyId,
    date: data.date,
    description: `Pago a proveedor — ${vendor.name}`,
    lines: [
      { accountId: payableGlAccountId, debit: amount.toNumber(), credit: 0 },
      { accountId: treasuryAccount.glAccountId, debit: 0, credit: amount.toNumber() },
    ],
    origin: 'AUTOMATIC',
    sourceModule: 'accounts-payable',
    createdByUserId: userId,
    autoApprove: true,
  });

  return prisma.$transaction(async (tx) => {
    const payment = await tx.apPayment.create({
      data: {
        companyId,
        vendorId: vendor.id,
        date: data.date,
        amount,
        treasuryAccountId: treasuryAccount.id,
        journalEntryId: entry.id,
        createdByUserId: userId,
        applications: {
          create: applicationResults.map((result) => ({ billId: result.billId, amount: result.amount })),
        },
      },
      include: { applications: true },
    });

    for (const result of applicationResults) {
      await tx.apBill.update({
        where: { id: result.billId },
        data: { paidAmount: result.newPaidAmount, status: result.newStatus },
      });
    }

    await tx.treasuryAccount.update({
      where: { id: treasuryAccount.id },
      data: { currentBalance: { decrement: amount } },
    });

    await auditService.log(
      { companyId, userId, action: 'ap_payment.recorded', entityType: 'ApPayment', entityId: payment.id, oldValue: null, newValue: payment },
      tx
    );

    return payment;
  });
}

async function getPayment(companyId, id) {
  const payment = await prisma.apPayment.findFirst({
    where: { id, companyId },
    include: { vendor: true, applications: { include: { bill: true } }, journalEntry: true },
  });
  if (!payment) {
    throw new AppError('El pago indicado no existe.', 404, 'AP_PAYMENT_NOT_FOUND');
  }
  return payment;
}

async function listPayments(companyId, { vendorId } = {}) {
  return prisma.apPayment.findMany({
    where: { companyId, vendorId: vendorId || undefined },
    include: { vendor: true },
    orderBy: { date: 'desc' },
  });
}

module.exports = { recordPayment, getPayment, listPayments };
