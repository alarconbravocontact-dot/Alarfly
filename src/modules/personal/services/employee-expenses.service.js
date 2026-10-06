// Gastos de Personal: Registrado/En revisión (un solo estado,
// PENDING_APPROVAL) → Aprobado/Rechazado → Reembolsado. Mismo criterio
// de integración financiera que Nómina: al aprobar se postea UNA
// obligación vía core/ledger; al reembolsar se crea una PaymentOrder
// genérica de Tesorería — nunca un ledger ni un pago propios.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const periodLockService = require('../../../core/period-lock/period-lock.service');
const { assertPeriodOpen } = require('../../../core/period-lock/period-lock.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');
const personalSettingsService = require('./personal-settings.service');
const { assertCanDecide, assertCanReimburse } = require('./employee-expenses.rules');
const paymentOrdersService = require('../../treasury/services/payment-orders.service');

async function registerExpense(companyId, userId, data) {
  const employee = await prisma.employee.findFirst({ where: { id: data.employeeId, companyId } });
  if (!employee) {
    throw new AppError('El empleado indicado no existe.', 404, 'EMPLOYEE_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const expense = await tx.employeeExpense.create({ data: { companyId, registeredByUserId: userId, ...data } });
    await auditService.log(
      { companyId, userId, action: 'employee_expense.registered', entityType: 'EmployeeExpense', entityId: expense.id, oldValue: null, newValue: { employeeId: expense.employeeId, amount: expense.amount, category: expense.category } },
      tx
    );
    return expense;
  });
}

async function listExpenses(companyId, { employeeId, status } = {}) {
  return prisma.employeeExpense.findMany({
    where: { companyId, employeeId: employeeId || undefined, status: status || undefined },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { expenseDate: 'desc' },
  });
}

async function getExpense(companyId, id) {
  const expense = await prisma.employeeExpense.findFirst({
    where: { id, companyId },
    include: { employee: { select: { id: true, firstName: true, lastName: true } }, paymentOrder: { select: { id: true, status: true } } },
  });
  if (!expense) {
    throw new AppError('El gasto indicado no existe.', 404, 'EXPENSE_NOT_FOUND');
  }
  return expense;
}

// Decidir (aprobar/rechazar, sección 14). Al aprobar, postea de una
// vez el asiento de obligación (Debe Gasto, Haber Reembolsos por
// Pagar) — el reembolso en sí queda como un paso aparte (ver
// reimburseExpense), tal como pide el diagrama de 4 estados del
// prompt del módulo.
async function decideExpense(companyId, id, approverUserId, { decision, rejectionReason }) {
  const expense = await prisma.employeeExpense.findFirst({ where: { id, companyId }, include: { employee: true } });
  if (!expense) {
    throw new AppError('El gasto indicado no existe.', 404, 'EXPENSE_NOT_FOUND');
  }
  assertCanDecide(expense, approverUserId);

  if (decision === 'REJECTED') {
    if (!rejectionReason) {
      throw new AppError('Debes indicar el motivo del rechazo.', 400, 'REJECTION_REASON_REQUIRED');
    }
    return prisma.$transaction(async (tx) => {
      const updated = await tx.employeeExpense.update({ where: { id }, data: { status: 'REJECTED', approvedByUserId: approverUserId, approvedAt: new Date(), rejectionReason } });
      await auditService.log(
        { companyId, userId: approverUserId, action: 'employee_expense.rejected', entityType: 'EmployeeExpense', entityId: id, oldValue: { status: expense.status }, newValue: { status: 'REJECTED', rejectionReason } },
        tx
      );
      return updated;
    });
  }

  const { expenseAccountId, payableAccountId } = await personalSettingsService.assertExpenseAccountsConfigured(companyId);
  const period = await periodLockService.getPeriodForDate(companyId, expense.expenseDate);
  assertPeriodOpen(period);

  const updated = await withTransaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: expense.expenseDate,
        description: `Gasto de personal — ${expense.employee.firstName} ${expense.employee.lastName}: ${expense.description}`,
        lines: [
          {
            accountId: expenseAccountId,
            debit: Number(expense.amount),
            credit: 0,
            dimensionIds: expense.employee.branchDimensionId ? [expense.employee.branchDimensionId] : undefined,
          },
          { accountId: payableAccountId, debit: 0, credit: Number(expense.amount) },
        ],
        origin: 'AUTOMATIC',
        sourceModule: 'personal',
        sourceReference: id,
        createdByUserId: approverUserId,
        autoApprove: true,
      },
      tx
    );

    if (expense.employee.fpaDimensionId) {
      const debitLine = entry.lines.find((l) => l.order === 0);
      await tx.journalEntryLineFpaDimension.create({ data: { lineId: debitLine.id, fpaDimensionId: expense.employee.fpaDimensionId } });
    }

    const result = await tx.employeeExpense.update({
      where: { id },
      data: { status: 'APPROVED', approvedByUserId: approverUserId, approvedAt: new Date(), accrualJournalEntryId: entry.id },
    });
    await auditService.log(
      { companyId, userId: approverUserId, action: 'employee_expense.approved', entityType: 'EmployeeExpense', entityId: id, oldValue: { status: expense.status }, newValue: { status: 'APPROVED', journalEntryId: entry.id } },
      tx
    );
    return result;
  });

  return updated;
}

// Reembolsar (sección 14, último paso): crea la orden de pago genérica
// de Tesorería que liquida el pasivo reconocido al aprobar.
async function reimburseExpense(companyId, id, userId, { treasuryAccountId }) {
  const expense = await prisma.employeeExpense.findFirst({ where: { id, companyId }, include: { employee: true } });
  if (!expense) {
    throw new AppError('El gasto indicado no existe.', 404, 'EXPENSE_NOT_FOUND');
  }
  assertCanReimburse(expense);
  const { payableAccountId } = await personalSettingsService.assertExpenseAccountsConfigured(companyId);

  const order = await paymentOrdersService.createPaymentOrder(companyId, userId, {
    treasuryAccountId,
    glAccountId: payableAccountId,
    payeeName: `${expense.employee.firstName} ${expense.employee.lastName}`,
    amount: expense.amount,
    currency: expense.currency,
    description: `Reembolso de gasto — ${expense.description}`,
    scheduledDate: new Date(),
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.employeeExpense.update({
      where: { id },
      data: { status: 'REIMBURSED', reimbursedByUserId: userId, reimbursedAt: new Date(), paymentOrderId: order.id },
    });
    await auditService.log(
      { companyId, userId, action: 'employee_expense.reimbursed', entityType: 'EmployeeExpense', entityId: id, oldValue: { status: expense.status }, newValue: { status: 'REIMBURSED', paymentOrderId: order.id } },
      tx
    );
    return updated;
  });
}

module.exports = { registerExpense, listExpenses, getExpense, decideExpense, reimburseExpense };
