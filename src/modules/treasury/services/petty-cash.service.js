const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const periodLockService = require('../../../core/period-lock/period-lock.service');
const { assertPeriodOpen } = require('../../../core/period-lock/period-lock.rules');
const { assertCanApproveExpense } = require('./petty-cash-approval.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');

async function createFund(companyId, userId, data) {
  const glAccount = await prisma.account.findFirst({ where: { id: data.glAccountId, companyId } });
  if (!glAccount) {
    throw new AppError('La cuenta contable de caja chica indicada no existe.', 404, 'ACCOUNT_NOT_FOUND');
  }
  const custodian = await prisma.user.findFirst({ where: { id: data.custodianUserId, companyId } });
  if (!custodian) {
    throw new AppError('El responsable indicado no existe en esta empresa.', 404, 'USER_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const fund = await tx.pettyCashFund.create({
      data: { companyId, createdByUserId: userId, currentBalance: data.initialAmount, ...data },
    });
    await auditService.log(
      { companyId, userId, action: 'petty_cash_fund.created', entityType: 'PettyCashFund', entityId: fund.id, oldValue: null, newValue: fund },
      tx
    );
    return fund;
  });
}

async function listFunds(companyId, { status } = {}) {
  return prisma.pettyCashFund.findMany({ where: { companyId, status: status || undefined }, orderBy: { name: 'asc' } });
}

async function getFund(companyId, id) {
  const fund = await prisma.pettyCashFund.findFirst({ where: { id, companyId } });
  if (!fund) throw new AppError('El fondo de caja chica indicado no existe.', 404, 'PETTY_CASH_FUND_NOT_FOUND');
  return fund;
}

// El empleado (maker) registra el gasto; queda pendiente de que un
// supervisor distinto lo apruebe antes de afectar el fondo.
async function registerExpense(companyId, userId, data) {
  const fund = await prisma.pettyCashFund.findFirst({ where: { id: data.fundId, companyId } });
  if (!fund) throw new AppError('El fondo de caja chica indicado no existe.', 404, 'PETTY_CASH_FUND_NOT_FOUND');
  if (fund.status !== 'ACTIVE') throw new AppError('Este fondo de caja chica está cerrado.', 409, 'FUND_NOT_ACTIVE');

  const expenseAccount = await prisma.account.findFirst({ where: { id: data.expenseGlAccountId, companyId } });
  if (!expenseAccount) throw new AppError('La cuenta de gasto indicada no existe.', 404, 'ACCOUNT_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const expense = await tx.pettyCashExpense.create({
      data: { companyId, registeredByUserId: userId, ...data },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'petty_cash_expense.registered',
        entityType: 'PettyCashExpense',
        entityId: expense.id,
        oldValue: null,
        newValue: expense,
      },
      tx
    );
    return expense;
  });
}

async function decideExpense(companyId, expenseId, approverUserId, { decision, rejectionReason }) {
  const expense = await prisma.pettyCashExpense.findFirst({
    where: { id: expenseId, companyId },
    include: { fund: true },
  });
  if (!expense) throw new AppError('El gasto indicado no existe.', 404, 'EXPENSE_NOT_FOUND');

  const approver = await prisma.user.findUnique({ where: { id: approverUserId } });
  assertCanApproveExpense({ expense, approverUserId, approverRole: approver.role });

  if (decision === 'REJECTED') {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.pettyCashExpense.update({
        where: { id: expenseId },
        data: { status: 'REJECTED', approvedByUserId: approverUserId, approvedAt: new Date(), rejectionReason },
      });
      await auditService.log(
        {
          companyId,
          userId: approverUserId,
          action: 'petty_cash_expense.rejected',
          entityType: 'PettyCashExpense',
          entityId: expenseId,
          oldValue: { status: 'PENDING_APPROVAL' },
          newValue: { status: 'REJECTED', rejectionReason },
        },
        tx
      );
      return updated;
    });
  }

  const period = await periodLockService.getPeriodForDate(companyId, expense.expenseDate);
  assertPeriodOpen(period);

  return withTransaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: expense.expenseDate,
        description: `Gasto de caja chica: ${expense.description}`,
        lines: [
          { accountId: expense.expenseGlAccountId, debit: Number(expense.amount), credit: 0 },
          { accountId: expense.fund.glAccountId, debit: 0, credit: Number(expense.amount) },
        ],
        origin: 'AUTOMATIC',
        sourceModule: 'treasury',
        sourceReference: expenseId,
        createdByUserId: approverUserId,
        autoApprove: true,
      },
      tx
    );

    const updated = await tx.pettyCashExpense.update({
      where: { id: expenseId },
      data: { status: 'APPROVED', approvedByUserId: approverUserId, approvedAt: new Date(), paidJournalEntryId: entry.id },
    });
    await tx.pettyCashFund.update({ where: { id: expense.fundId }, data: { currentBalance: { decrement: expense.amount } } });
    await auditService.log(
      {
        companyId,
        userId: approverUserId,
        action: 'petty_cash_expense.approved',
        entityType: 'PettyCashExpense',
        entityId: expenseId,
        oldValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'APPROVED', journalEntryId: entry.id },
      },
      tx
    );
    return updated;
  });
}

// Aprobar/rechazar varios gastos a la vez (Feature P: barra de
// acciones masivas). NUNCA revalida el maker-checker por su cuenta:
// llama a `decideExpense` (la misma función de siempre) una vez por
// cada id, así que un gasto que no está pendiente, o que fue
// registrado por quien intenta aprobarlo ahora, se rechaza exactamente
// con el mismo error que ya usa la aprobación individual — la
// "validación mixta" es simplemente que un lote puede traer ids
// elegibles y no elegibles mezclados, y cada uno se resuelve por su
// cuenta sin que el resto del lote se vea afectado.
async function bulkDecideExpenses(companyId, expenseIds, approverUserId, { decision, rejectionReason }) {
  const results = [];
  for (const expenseId of expenseIds) {
    try {
      await decideExpense(companyId, expenseId, approverUserId, { decision, rejectionReason });
      results.push({ id: expenseId, status: 'done' });
    } catch (err) {
      results.push({ id: expenseId, status: 'skipped', reason: err.message || 'No se pudo procesar.' });
    }
  }
  return results;
}

async function listExpenses(companyId, { fundId, status } = {}) {
  return prisma.pettyCashExpense.findMany({
    where: { companyId, fundId: fundId || undefined, status: status || undefined },
    orderBy: { expenseDate: 'desc' },
  });
}

// Trae plata de vuelta al fondo desde una cuenta bancaria, hasta el
// monto que se le indique (normalmente lo que falta para llegar al
// monto inicial).
async function replenishFund(companyId, fundId, userId, amount, date) {
  const fund = await prisma.pettyCashFund.findFirst({ where: { id: fundId, companyId }, include: { treasuryAccount: true } });
  if (!fund) throw new AppError('El fondo de caja chica indicado no existe.', 404, 'PETTY_CASH_FUND_NOT_FOUND');
  if (!fund.treasuryAccountId) {
    throw new AppError('Este fondo no tiene una cuenta bancaria de origen configurada.', 400, 'NO_TREASURY_ACCOUNT');
  }

  const replenishDate = date || new Date();
  const period = await periodLockService.getPeriodForDate(companyId, replenishDate);
  assertPeriodOpen(period);

  return withTransaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: replenishDate,
        description: `Reposición de caja chica "${fund.name}"`,
        lines: [
          { accountId: fund.glAccountId, debit: Number(amount), credit: 0 },
          { accountId: fund.treasuryAccount.glAccountId, debit: 0, credit: Number(amount) },
        ],
        origin: 'AUTOMATIC',
        sourceModule: 'treasury',
        sourceReference: fundId,
        createdByUserId: userId,
        autoApprove: true,
      },
      tx
    );

    const updated = await tx.pettyCashFund.update({ where: { id: fundId }, data: { currentBalance: { increment: amount } } });
    await tx.treasuryAccount.update({ where: { id: fund.treasuryAccountId }, data: { currentBalance: { decrement: amount } } });
    await tx.pettyCashReplenishment.create({
      data: { fundId, amount, date: replenishDate, journalEntryId: entry.id, createdByUserId: userId },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'petty_cash_fund.replenished',
        entityType: 'PettyCashFund',
        entityId: fundId,
        oldValue: null,
        newValue: { amount, journalEntryId: entry.id },
      },
      tx
    );
    return updated;
  });
}

module.exports = { createFund, listFunds, getFund, registerExpense, decideExpense, bulkDecideExpenses, listExpenses, replenishFund };
