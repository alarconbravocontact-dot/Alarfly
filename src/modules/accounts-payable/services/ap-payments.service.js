// Pagos a proveedores, aplicados a una o varias facturas. Postea
// directo vía core/ledger (débito la cuenta de Cuentas por Pagar,
// crédito la cuenta de efectivo de la TreasuryAccount elegida). Ya
// conectado también con el flujo de aprobación multinivel de Tesorería
// como alternativa (ver PaymentOrder.vendorId/decideApproval) — este
// servicio sigue siendo el pago directo, sin maker-checker, para cuando
// no se necesita ese flujo. AP no admite anticipos (a diferencia de AR):
// `applyPaymentToBills` siempre exige que la suma aplicada sea exacta.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const fxService = require('../../../core/fx/fx.service');
const { applyPaymentToBills } = require('./ap-bills.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');

const { Decimal } = Prisma;

// Fase 4 (punto BCV, espejo de ar-payments.service.resolveForeignAmount):
// si el pago se registra en una moneda distinta a la base (ej. Bs.),
// resuelve la tasa vigente UNA vez y la devuelve para guardarla como
// snapshot — reutiliza core/fx.getLatestRate, ya probado.
async function resolveForeignAmount(companyId, data) {
  if (!data.foreignCurrency || data.foreignAmount == null) return null;
  const rate = await fxService.getLatestRate(companyId, data.foreignCurrency, data.date);
  if (!rate) {
    throw new AppError(
      `No hay una tasa de cambio registrada para ${data.foreignCurrency} en o antes de esa fecha.`,
      400,
      'EXCHANGE_RATE_NOT_FOUND'
    );
  }
  const foreignAmount = new Decimal(data.foreignAmount);
  return { foreignCurrency: data.foreignCurrency, foreignAmount, exchangeRate: new Decimal(rate.rate), amount: foreignAmount.times(rate.rate) };
}

async function resolvePaymentMethod(companyId, paymentMethodId) {
  if (!paymentMethodId) return null;
  const method = await prisma.paymentMethod.findFirst({ where: { id: paymentMethodId, companyId, isActive: true } });
  if (!method) {
    throw new AppError('El método de pago indicado no existe o está inactivo.', 404, 'PAYMENT_METHOD_NOT_FOUND');
  }
  return method;
}

async function recordPayment(companyId, userId, data) {
  const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, companyId } });
  if (!vendor) {
    throw new AppError('El proveedor indicado no existe.', 404, 'VENDOR_NOT_FOUND');
  }

  const treasuryAccount = await prisma.treasuryAccount.findFirst({ where: { id: data.treasuryAccountId, companyId } });
  if (!treasuryAccount) {
    throw new AppError('La cuenta de Tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }

  const paymentMethod = await resolvePaymentMethod(companyId, data.paymentMethodId);
  const foreign = await resolveForeignAmount(companyId, data);
  const payableGlAccountId = await arApSettingsService.assertPayableAccountConfigured(companyId);

  const billIds = data.applications.map((application) => application.billId);
  const bills = await prisma.apBill.findMany({ where: { id: { in: billIds }, companyId, vendorId: vendor.id } });
  const billsById = new Map(bills.map((bill) => [bill.id, bill]));

  const amount = foreign ? foreign.amount : new Decimal(data.amount);
  const applicationResults = applyPaymentToBills(amount, data.applications, billsById);

  // Fase 1: asiento + registro del pago + saldo de tesorería en una sola
  // transacción.
  return withTransaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: data.date,
        description: `Pago a proveedor — ${vendor.name}`,
        lines: [
          { accountId: payableGlAccountId, debit: amount.toNumber(), credit: 0 },
          { accountId: treasuryAccount.glAccountId, debit: 0, credit: amount.toNumber() },
        ],
        origin: 'AUTOMATIC',
        sourceModule: 'accounts-payable',
        sourceReference: vendor.id,
        createdByUserId: userId,
        autoApprove: true,
      },
      tx
    );

    const payment = await tx.apPayment.create({
      data: {
        companyId,
        vendorId: vendor.id,
        date: data.date,
        amount,
        treasuryAccountId: treasuryAccount.id,
        journalEntryId: entry.id,
        paymentMethodId: paymentMethod?.id || null,
        foreignCurrency: foreign?.foreignCurrency || null,
        foreignAmount: foreign?.foreignAmount || null,
        exchangeRate: foreign?.exchangeRate || null,
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
