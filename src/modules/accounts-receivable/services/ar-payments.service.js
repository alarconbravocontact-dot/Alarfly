// Cobros de clientes, aplicados a una o varias facturas. Postea
// directo vía core/ledger (débito la cuenta de efectivo de la
// TreasuryAccount elegida, crédito la cuenta de Cuentas por Cobrar
// configurada) — no pasa por Fiscal porque un cobro no es una venta ni
// una compra, es solo un movimiento de efectivo contra un saldo que
// Fiscal ya generó al facturar.
//
// Conexión con Tesorería: si el cobro viene de un movimiento bancario
// real ya importado (bankTransactionId), el monto y la cuenta de
// tesorería se derivan de ESE movimiento — nunca de un número escrito
// a mano — y el movimiento queda marcado como conciliado (mismo
// mecanismo de BankTransaction/status que ya usa la conciliación de
// Tesorería, sin tabla nueva). El registro directo (sin banco) sigue
// disponible para cobros que no pasan por un extracto (ej. efectivo).
//
// Si `applications` viene vacío, el cobro queda como anticipo sin
// aplicar — se aplica después con `applyAdvancePayment`.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const { applyPaymentToInvoices } = require('./ar-invoices.rules');

const { Decimal } = Prisma;

async function resolvePaymentSource(companyId, data) {
  if (data.bankTransactionId) {
    const bankTransaction = await prisma.bankTransaction.findFirst({ where: { id: data.bankTransactionId, companyId } });
    if (!bankTransaction) {
      throw new AppError('El movimiento bancario indicado no existe.', 404, 'BANK_TRANSACTION_NOT_FOUND');
    }
    if (bankTransaction.status !== 'UNMATCHED') {
      throw new AppError('Este movimiento bancario ya está conciliado con otra cosa.', 409, 'BANK_TRANSACTION_ALREADY_MATCHED');
    }
    const amount = new Decimal(bankTransaction.amount);
    if (!amount.isPositive()) {
      throw new AppError('El movimiento bancario indicado no es una entrada de dinero.', 400, 'BANK_TRANSACTION_NOT_INFLOW');
    }
    const treasuryAccount = await prisma.treasuryAccount.findUnique({ where: { id: bankTransaction.treasuryAccountId } });
    return { treasuryAccount, amount, bankTransaction };
  }

  const treasuryAccount = await prisma.treasuryAccount.findFirst({ where: { id: data.treasuryAccountId, companyId } });
  if (!treasuryAccount) {
    throw new AppError('La cuenta de Tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }
  return { treasuryAccount, amount: new Decimal(data.amount), bankTransaction: null };
}

async function recordPayment(companyId, userId, data) {
  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId } });
  if (!customer) {
    throw new AppError('El cliente indicado no existe.', 404, 'CUSTOMER_NOT_FOUND');
  }

  const { treasuryAccount, amount, bankTransaction } = await resolvePaymentSource(companyId, data);
  const receivableGlAccountId = await arApSettingsService.assertReceivableAccountConfigured(companyId);

  let applicationResults = [];
  const applications = Array.isArray(data.applications) ? data.applications : [];
  if (applications.length > 0) {
    const invoiceIds = applications.map((application) => application.invoiceId);
    const invoices = await prisma.arInvoice.findMany({ where: { id: { in: invoiceIds }, companyId, customerId: customer.id } });
    const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    const totalApplied = applications.reduce((sum, application) => sum.plus(application.amount), new Decimal(0));
    if (totalApplied.greaterThan(amount)) {
      throw new AppError(
        `La suma aplicada (${totalApplied.toFixed(2)}) no puede superar el monto del cobro (${amount.toFixed(2)}).`,
        400,
        'APPLICATION_TOTAL_EXCEEDS_PAYMENT'
      );
    }
    applicationResults = applyPaymentToInvoices(totalApplied, applications, invoicesById);
  }

  const entry = await ledgerService.postEntry({
    companyId,
    date: data.date,
    description: `Cobro cliente — ${customer.name}`,
    lines: [
      { accountId: treasuryAccount.glAccountId, debit: amount.toNumber(), credit: 0 },
      { accountId: receivableGlAccountId, debit: 0, credit: amount.toNumber() },
    ],
    origin: 'AUTOMATIC',
    sourceModule: 'accounts-receivable',
    createdByUserId: userId,
    autoApprove: true,
  });

  const cashLine = entry.lines.find((line) => line.accountId === treasuryAccount.glAccountId);

  return prisma.$transaction(async (tx) => {
    const payment = await tx.arPayment.create({
      data: {
        companyId,
        customerId: customer.id,
        date: data.date,
        amount,
        treasuryAccountId: treasuryAccount.id,
        bankTransactionId: bankTransaction?.id || null,
        journalEntryId: entry.id,
        createdByUserId: userId,
        applications: {
          create: applicationResults.map((result) => ({ invoiceId: result.invoiceId, amount: result.amount })),
        },
      },
      include: { applications: true },
    });

    for (const result of applicationResults) {
      await tx.arInvoice.update({
        where: { id: result.invoiceId },
        data: { paidAmount: result.newPaidAmount, status: result.newStatus },
      });
    }

    await tx.treasuryAccount.update({
      where: { id: treasuryAccount.id },
      data: { currentBalance: { increment: amount } },
    });

    if (bankTransaction) {
      await tx.bankTransaction.update({
        where: { id: bankTransaction.id },
        data: { status: 'MATCHED', matchedJournalEntryLineId: cashLine.id },
      });
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'ar_payment.recorded',
        entityType: 'ArPayment',
        entityId: payment.id,
        oldValue: null,
        newValue: payment,
      },
      tx
    );

    return payment;
  });
}

// Aplica (total o parcialmente) el saldo sin aplicar de un cobro que
// se registró como anticipo — reutiliza la misma función pura de
// reparto que recordPayment, solo que el "monto del cobro" para esa
// validación es lo que se está aplicando ahora, no el total original.
async function applyAdvancePayment(companyId, userId, paymentId, applications) {
  const payment = await prisma.arPayment.findFirst({
    where: { id: paymentId, companyId },
    include: { applications: true },
  });
  if (!payment) {
    throw new AppError('El cobro indicado no existe.', 404, 'AR_PAYMENT_NOT_FOUND');
  }
  if (!Array.isArray(applications) || applications.length === 0) {
    throw new AppError('Debes indicar a qué factura(s) se aplica el anticipo.', 400, 'APPLICATIONS_REQUIRED');
  }

  const alreadyApplied = payment.applications.reduce((sum, application) => sum.plus(application.amount), new Decimal(0));
  const remaining = new Decimal(payment.amount).minus(alreadyApplied);

  const invoiceIds = applications.map((application) => application.invoiceId);
  const invoices = await prisma.arInvoice.findMany({
    where: { id: { in: invoiceIds }, companyId, customerId: payment.customerId },
  });
  const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  const totalToApply = applications.reduce((sum, application) => sum.plus(application.amount), new Decimal(0));
  if (totalToApply.greaterThan(remaining)) {
    throw new AppError(
      `Este cobro solo tiene ${remaining.toFixed(2)} sin aplicar todavía.`,
      400,
      'ADVANCE_EXCEEDS_REMAINING_BALANCE'
    );
  }

  const results = applyPaymentToInvoices(totalToApply, applications, invoicesById);

  return prisma.$transaction(async (tx) => {
    for (const result of results) {
      await tx.arPaymentApplication.create({
        data: { paymentId, invoiceId: result.invoiceId, amount: result.amount },
      });
      await tx.arInvoice.update({
        where: { id: result.invoiceId },
        data: { paidAmount: result.newPaidAmount, status: result.newStatus },
      });
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'ar_payment.advance_applied',
        entityType: 'ArPayment',
        entityId: paymentId,
        oldValue: null,
        newValue: { applied: results.map((r) => ({ invoiceId: r.invoiceId, amount: r.amount.toFixed(2) })) },
      },
      tx
    );

    return tx.arPayment.findUnique({ where: { id: paymentId }, include: { applications: true } });
  });
}

async function getPayment(companyId, id) {
  const payment = await prisma.arPayment.findFirst({
    where: { id, companyId },
    include: { customer: true, applications: { include: { invoice: true } }, journalEntry: true, bankTransaction: true },
  });
  if (!payment) {
    throw new AppError('El cobro indicado no existe.', 404, 'AR_PAYMENT_NOT_FOUND');
  }
  return payment;
}

async function listPayments(companyId, { customerId } = {}) {
  return prisma.arPayment.findMany({
    where: { companyId, customerId: customerId || undefined },
    include: { customer: true, applications: true },
    orderBy: { date: 'desc' },
  });
}

module.exports = { recordPayment, applyAdvancePayment, getPayment, listPayments };
