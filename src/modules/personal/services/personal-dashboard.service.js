// Resumen sencillo del módulo (sección 17 del prompt): solo los 6
// números pedidos, sin gráficos — de solo lectura, agrega datos reales
// ya guardados por Empleados/Nómina/Gastos, nunca inventa ni simula.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');

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

module.exports = { getDashboard, currentMonthRange };
