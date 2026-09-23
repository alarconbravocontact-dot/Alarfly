const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const periodLockService = require('../../../core/period-lock/period-lock.service');
const { assertPeriodOpen } = require('../../../core/period-lock/period-lock.rules');
const { generateInstallmentSchedule } = require('./debt-schedule.rules');

const { Decimal } = Prisma;

async function assertAccountBelongsToCompany(companyId, accountId, label) {
  const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
  if (!account) {
    throw new AppError(`La cuenta indicada para "${label}" no existe en esta empresa.`, 400, 'ACCOUNT_NOT_FOUND');
  }
  return account;
}

async function createDebt(companyId, userId, data) {
  const treasuryAccount = await prisma.treasuryAccount.findFirst({
    where: { id: data.treasuryAccountId, companyId },
  });
  if (!treasuryAccount) {
    throw new AppError('La cuenta de tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }
  await assertAccountBelongsToCompany(companyId, data.liabilityAccountId, 'pasivo');
  await assertAccountBelongsToCompany(companyId, data.interestExpenseAccountId, 'gasto financiero');

  if (data.type === 'LOAN' && !data.installmentCount) {
    throw new AppError('Los préstamos necesitan indicar el número de cuotas.', 400, 'MISSING_INSTALLMENT_COUNT');
  }

  return prisma.$transaction(async (tx) => {
    const debt = await tx.debt.create({ data: { companyId, createdByUserId: userId, ...data } });

    if (debt.type === 'LOAN') {
      const schedule = generateInstallmentSchedule({
        principalAmount: debt.principalAmount,
        interestRate: debt.interestRate,
        installmentCount: debt.installmentCount,
        startDate: debt.startDate,
      });
      await tx.debtInstallment.createMany({
        data: schedule.map((s) => ({
          debtId: debt.id,
          installmentNumber: s.installmentNumber,
          dueDate: s.dueDate,
          principalPortion: s.principalPortion.toNumber(),
          interestPortion: s.interestPortion.toNumber(),
        })),
      });
    }

    await auditService.log(
      { companyId, userId, action: 'debt.created', entityType: 'Debt', entityId: debt.id, oldValue: null, newValue: debt },
      tx
    );
    return debt;
  });
}

// Desembolso inicial de un préstamo: entra el dinero a la cuenta de
// tesorería y nace el pasivo. Solo aplica una vez por préstamo.
async function disburseLoan(companyId, debtId, userId) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, companyId }, include: { treasuryAccount: true } });
  if (!debt) throw new AppError('La deuda indicada no existe.', 404, 'DEBT_NOT_FOUND');
  if (debt.type !== 'LOAN') throw new AppError('Solo los préstamos tienen desembolso inicial.', 400, 'NOT_A_LOAN');
  if (debt.isDisbursed) throw new AppError('Este préstamo ya fue desembolsado.', 409, 'ALREADY_DISBURSED');

  const period = await periodLockService.getPeriodForDate(companyId, debt.startDate);
  assertPeriodOpen(period);

  const entry = await ledgerService.postEntry({
    companyId,
    date: debt.startDate,
    description: `Desembolso de préstamo "${debt.name}" (${debt.lender})`,
    lines: [
      { accountId: debt.treasuryAccount.glAccountId, debit: Number(debt.principalAmount), credit: 0 },
      { accountId: debt.liabilityAccountId, debit: 0, credit: Number(debt.principalAmount) },
    ],
    origin: 'AUTOMATIC',
    sourceModule: 'treasury',
    sourceReference: debtId,
    createdByUserId: userId,
    autoApprove: true,
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.debt.update({
      where: { id: debtId },
      data: { isDisbursed: true, outstandingBalance: debt.principalAmount },
    });
    await tx.treasuryAccount.update({
      where: { id: debt.treasuryAccountId },
      data: { currentBalance: { increment: debt.principalAmount } },
    });
    await tx.debtMovement.create({
      data: { debtId, type: 'DISBURSEMENT', amount: debt.principalAmount, date: debt.startDate, journalEntryId: entry.id, createdByUserId: userId },
    });
    await auditService.log(
      { companyId, userId, action: 'debt.disbursed', entityType: 'Debt', entityId: debtId, oldValue: null, newValue: { journalEntryId: entry.id } },
      tx
    );
    return updated;
  });
}

// Disposición de una línea de crédito: hasta principalAmount - outstandingBalance.
async function drawdown(companyId, debtId, userId, amount, date) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, companyId }, include: { treasuryAccount: true } });
  if (!debt) throw new AppError('La deuda indicada no existe.', 404, 'DEBT_NOT_FOUND');
  if (debt.type !== 'CREDIT_LINE') throw new AppError('Solo las líneas de crédito tienen disposiciones.', 400, 'NOT_A_CREDIT_LINE');

  const available = debt.principalAmount.minus(debt.outstandingBalance);
  if (new Decimal(amount).greaterThan(available)) {
    throw new AppError(`La línea de crédito solo tiene ${available.toFixed(2)} disponibles.`, 400, 'INSUFFICIENT_CREDIT_LINE');
  }

  const drawDate = date || new Date();
  const period = await periodLockService.getPeriodForDate(companyId, drawDate);
  assertPeriodOpen(period);

  const entry = await ledgerService.postEntry({
    companyId,
    date: drawDate,
    description: `Disposición de línea de crédito "${debt.name}" (${debt.lender})`,
    lines: [
      { accountId: debt.treasuryAccount.glAccountId, debit: Number(amount), credit: 0 },
      { accountId: debt.liabilityAccountId, debit: 0, credit: Number(amount) },
    ],
    origin: 'AUTOMATIC',
    sourceModule: 'treasury',
    sourceReference: debtId,
    createdByUserId: userId,
    autoApprove: true,
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.debt.update({ where: { id: debtId }, data: { outstandingBalance: { increment: amount } } });
    await tx.treasuryAccount.update({ where: { id: debt.treasuryAccountId }, data: { currentBalance: { increment: amount } } });
    await tx.debtMovement.create({
      data: { debtId, type: 'DRAWDOWN', amount, date: drawDate, journalEntryId: entry.id, createdByUserId: userId },
    });
    await auditService.log(
      { companyId, userId, action: 'debt.drawdown', entityType: 'Debt', entityId: debtId, oldValue: null, newValue: { amount, journalEntryId: entry.id } },
      tx
    );
    return updated;
  });
}

async function repayCreditLine(companyId, debtId, userId, amount, date) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, companyId }, include: { treasuryAccount: true } });
  if (!debt) throw new AppError('La deuda indicada no existe.', 404, 'DEBT_NOT_FOUND');
  if (debt.type !== 'CREDIT_LINE') throw new AppError('Solo las líneas de crédito se repagan así.', 400, 'NOT_A_CREDIT_LINE');
  if (new Decimal(amount).greaterThan(debt.outstandingBalance)) {
    throw new AppError('El monto a pagar es mayor que el saldo usado de la línea.', 400, 'AMOUNT_EXCEEDS_BALANCE');
  }

  const repayDate = date || new Date();
  const period = await periodLockService.getPeriodForDate(companyId, repayDate);
  assertPeriodOpen(period);

  const entry = await ledgerService.postEntry({
    companyId,
    date: repayDate,
    description: `Pago de línea de crédito "${debt.name}" (${debt.lender})`,
    lines: [
      { accountId: debt.liabilityAccountId, debit: Number(amount), credit: 0 },
      { accountId: debt.treasuryAccount.glAccountId, debit: 0, credit: Number(amount) },
    ],
    origin: 'AUTOMATIC',
    sourceModule: 'treasury',
    sourceReference: debtId,
    createdByUserId: userId,
    autoApprove: true,
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.debt.update({ where: { id: debtId }, data: { outstandingBalance: { decrement: amount } } });
    await tx.treasuryAccount.update({ where: { id: debt.treasuryAccountId }, data: { currentBalance: { decrement: amount } } });
    await tx.debtMovement.create({
      data: { debtId, type: 'REPAYMENT', amount, date: repayDate, journalEntryId: entry.id, createdByUserId: userId },
    });
    await auditService.log(
      { companyId, userId, action: 'debt.repayment', entityType: 'Debt', entityId: debtId, oldValue: null, newValue: { amount, journalEntryId: entry.id } },
      tx
    );
    return updated;
  });
}

async function payInstallment(companyId, debtId, installmentId, userId) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, companyId }, include: { treasuryAccount: true } });
  if (!debt) throw new AppError('La deuda indicada no existe.', 404, 'DEBT_NOT_FOUND');

  const installment = await prisma.debtInstallment.findFirst({ where: { id: installmentId, debtId } });
  if (!installment) throw new AppError('La cuota indicada no existe.', 404, 'INSTALLMENT_NOT_FOUND');
  if (installment.status === 'PAID') throw new AppError('Esta cuota ya está pagada.', 409, 'INSTALLMENT_ALREADY_PAID');

  const period = await periodLockService.getPeriodForDate(companyId, installment.dueDate);
  assertPeriodOpen(period);

  const totalPayment = installment.principalPortion.plus(installment.interestPortion);

  const entry = await ledgerService.postEntry({
    companyId,
    date: installment.dueDate,
    description: `Cuota ${installment.installmentNumber} de préstamo "${debt.name}" (${debt.lender})`,
    lines: [
      { accountId: debt.liabilityAccountId, debit: installment.principalPortion.toNumber(), credit: 0 },
      { accountId: debt.interestExpenseAccountId, debit: installment.interestPortion.toNumber(), credit: 0 },
      { accountId: debt.treasuryAccount.glAccountId, debit: 0, credit: totalPayment.toNumber() },
    ],
    origin: 'AUTOMATIC',
    sourceModule: 'treasury',
    sourceReference: installmentId,
    createdByUserId: userId,
    autoApprove: true,
  });

  return prisma.$transaction(async (tx) => {
    const updatedInstallment = await tx.debtInstallment.update({
      where: { id: installmentId },
      data: { status: 'PAID', paidJournalEntryId: entry.id, paidAt: new Date() },
    });

    const newOutstanding = debt.outstandingBalance.minus(installment.principalPortion);
    const pendingCount = await tx.debtInstallment.count({ where: { debtId, status: 'PENDING' } });
    await tx.debt.update({
      where: { id: debtId },
      data: {
        outstandingBalance: newOutstanding,
        status: pendingCount === 0 ? 'PAID_OFF' : debt.status,
      },
    });
    await tx.treasuryAccount.update({
      where: { id: debt.treasuryAccountId },
      data: { currentBalance: { decrement: totalPayment } },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'debt.installment_paid',
        entityType: 'DebtInstallment',
        entityId: installmentId,
        oldValue: { status: 'PENDING' },
        newValue: { status: 'PAID', journalEntryId: entry.id },
      },
      tx
    );
    return updatedInstallment;
  });
}

async function listDebts(companyId, { type, status } = {}) {
  return prisma.debt.findMany({
    where: { companyId, type: type || undefined, status: status || undefined },
    orderBy: { createdAt: 'desc' },
  });
}

async function getDebt(companyId, id) {
  const debt = await prisma.debt.findFirst({
    where: { id, companyId },
    include: { installments: { orderBy: { installmentNumber: 'asc' } }, movements: { orderBy: { date: 'desc' } } },
  });
  if (!debt) throw new AppError('La deuda indicada no existe.', 404, 'DEBT_NOT_FOUND');
  return debt;
}

module.exports = { createDebt, disburseLoan, drawdown, repayCreditLine, payInstallment, listDebts, getDebt };
