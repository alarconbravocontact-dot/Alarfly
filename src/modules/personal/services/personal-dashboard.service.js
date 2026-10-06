// Resumen sencillo del módulo (sección 17 del prompt): solo los 6
// números pedidos, sin gráficos — de solo lectura, agrega datos reales
// ya guardados por Empleados/Nómina/Gastos, nunca inventa ni simula.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const { buildCostTrend } = require('./personal-dashboard.rules');

const { Decimal } = Prisma;

function currentMonthRange(reference = new Date()) {
  const from = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const to = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function sumDecimal(rows, field) {
  return rows.reduce((sum, row) => sum.plus(row[field]), new Decimal(0));
}

async function getDashboard(companyId) {
  const { from, to } = currentMonthRange();

  const [activeEmployeeCount, payrollsThisPeriod, pendingPayrolls, pendingExpenses, expensesThisPeriod, paidPayrollsThisPeriod, reimbursedExpensesThisPeriod] =
    await Promise.all([
      prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.payroll.findMany({ where: { companyId, endDate: { gte: from, lte: to } }, select: { netTotal: true } }),
      prisma.payroll.findMany({ where: { companyId, status: 'APPROVED' }, select: { netTotal: true } }),
      prisma.employeeExpense.findMany({ where: { companyId, status: 'PENDING_APPROVAL' }, select: { amount: true } }),
      prisma.employeeExpense.findMany({ where: { companyId, expenseDate: { gte: from, lte: to } }, select: { amount: true } }),
      prisma.payroll.findMany({ where: { companyId, status: 'PAID', paymentDate: { gte: from, lte: to } }, select: { netTotal: true } }),
      prisma.employeeExpense.findMany({ where: { companyId, status: 'REIMBURSED', reimbursedAt: { gte: from, lte: to } }, select: { amount: true } }),
    ]);

  return {
    activeEmployeeCount,
    payrollThisPeriod: sumDecimal(payrollsThisPeriod, 'netTotal'),
    pendingPayroll: sumDecimal(pendingPayrolls, 'netTotal'),
    pendingExpenses: sumDecimal(pendingExpenses, 'amount'),
    expensesThisPeriod: sumDecimal(expensesThisPeriod, 'amount'),
    totalPersonnelCost: sumDecimal(paidPayrollsThisPeriod, 'netTotal').plus(sumDecimal(reimbursedExpensesThisPeriod, 'amount')),
    periodFrom: from,
    periodTo: to,
  };
}

// Integración transversal (Dashboard/Finanzas/Alertas): los 4 estados
// de "algo de Personal necesita una acción" — ninguno es un dato
// nuevo, son los mismos `Payroll`/`EmployeeExpense` que ya existen,
// agrupados por estado. `payrollPendingApproval` = `REVIEWED` (ya
// calculada y revisada, lista para que alguien la apruebe);
// `payrollPendingPayment` = `APPROVED` (ya generó su asiento de
// obligación vía `core/ledger`, todavía sin `PaymentOrder`);
// `expensesPendingReview` = `PENDING_APPROVAL`; `expensesPendingReimbursement`
// = `APPROVED` (obligación ya reconocida, todavía sin reembolsar).
async function getObligationsSummary(companyId) {
  const [payrollPendingApproval, payrollPendingPayment, expensesPendingReview, expensesPendingReimbursement] = await Promise.all([
    prisma.payroll.findMany({ where: { companyId, status: 'REVIEWED' }, select: { id: true, label: true, netTotal: true } }),
    prisma.payroll.findMany({ where: { companyId, status: 'APPROVED' }, select: { id: true, label: true, netTotal: true } }),
    prisma.employeeExpense.findMany({
      where: { companyId, status: 'PENDING_APPROVAL' },
      select: { id: true, amount: true, employee: { select: { firstName: true, lastName: true } } },
    }),
    prisma.employeeExpense.findMany({
      where: { companyId, status: 'APPROVED' },
      select: { id: true, amount: true, employee: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return {
    payrollPendingApproval: { count: payrollPendingApproval.length, total: sumDecimal(payrollPendingApproval, 'netTotal'), items: payrollPendingApproval },
    payrollPendingPayment: { count: payrollPendingPayment.length, total: sumDecimal(payrollPendingPayment, 'netTotal'), items: payrollPendingPayment },
    expensesPendingReview: { count: expensesPendingReview.length, total: sumDecimal(expensesPendingReview, 'amount'), items: expensesPendingReview },
    expensesPendingReimbursement: {
      count: expensesPendingReimbursement.length,
      total: sumDecimal(expensesPendingReimbursement, 'amount'),
      items: expensesPendingReimbursement,
    },
  };
}

// "Evolución del costo de personal" (Analítica): mismo patrón que
// `ar-invoices.service.getSalesTrend`/`buildSalesTrend` — un punto por
// cada uno de los últimos `months` meses, en 0 si no hubo costo real
// ese mes, nunca "saltado". Costo REAL (igual criterio que
// `totalPersonnelCost` de `getDashboard`): nómina ya pagada (por
// `paymentDate`) + gastos ya reembolsados (por `reimbursedAt`) — nunca
// lo aprobado-pero-no-ejecutado, que ya reportan los otros campos.
async function getCostTrend(companyId, months = 6) {
  const referenceDate = new Date();
  const rangeStart = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - (months - 1), 1));

  const [paidPayrolls, reimbursedExpenses] = await Promise.all([
    prisma.payroll.findMany({ where: { companyId, status: 'PAID', paymentDate: { gte: rangeStart } }, select: { paymentDate: true, netTotal: true } }),
    prisma.employeeExpense.findMany({
      where: { companyId, status: 'REIMBURSED', reimbursedAt: { gte: rangeStart } },
      select: { reimbursedAt: true, amount: true },
    }),
  ]);

  return buildCostTrend(paidPayrolls, reimbursedExpenses, months, referenceDate);
}

module.exports = { getDashboard, currentMonthRange, getObligationsSummary, getCostTrend };
