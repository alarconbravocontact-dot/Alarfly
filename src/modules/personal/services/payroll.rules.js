// Funciones puras del flujo de Nómina — sin acceso a base de datos,
// fáciles de probar. Borrador→Calculada→Revisada→Aprobada→Pagada
// (sección 7 del prompt del módulo), con la misma posibilidad de
// "rebotar" un paso atrás que ya usa el Presupuesto de FP&A
// (DRAFT↔IN_REVIEW) — nunca un workflow lineal rígido que obligue a
// cancelar y empezar de nuevo por un error menor.
const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

const EDITABLE_STATUSES = ['DRAFT', 'CALCULATED'];

const TRANSITIONS = {
  DRAFT: ['CALCULATED'],
  CALCULATED: ['REVIEWED', 'DRAFT'],
  REVIEWED: ['APPROVED', 'CALCULATED'],
  APPROVED: ['PAID'],
  PAID: [],
};

function assertCanTransition(currentStatus, nextStatus) {
  const allowed = TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      `No se puede pasar una nómina de "${currentStatus}" a "${nextStatus}".`,
      409,
      'INVALID_PAYROLL_TRANSITION'
    );
  }
}

function assertEditable(status) {
  if (!EDITABLE_STATUSES.includes(status)) {
    throw new AppError('Esta nómina ya no se puede editar en su estado actual.', 409, 'PAYROLL_NOT_EDITABLE');
  }
}

function sumBreakdown(breakdown) {
  if (!Array.isArray(breakdown)) return new Decimal(0);
  return breakdown.reduce((sum, item) => sum.plus(new Decimal(item.amount || 0)), new Decimal(0));
}

// Totales de UNA línea (un empleado): salario base "congelado" +
// desglose de ingresos/deducciones (sección 8: ingresos = salario base
// + otros ingresos; deducciones; resultado = total ingresos - total
// deducciones).
function computeItemTotals(baseSalary, incomeBreakdown, deductionBreakdown) {
  const income = sumBreakdown(incomeBreakdown);
  const deductions = sumBreakdown(deductionBreakdown);
  const totalIncome = new Decimal(baseSalary).plus(income);
  const totalDeductions = deductions;
  const netPay = totalIncome.minus(totalDeductions);
  if (netPay.isNegative()) {
    throw new AppError('Las deducciones no pueden superar el total de ingresos de esta línea.', 400, 'NEGATIVE_NET_PAY');
  }
  return { totalIncome, totalDeductions, netPay };
}

// Agrega los totales de toda la nómina a partir de sus líneas ya
// calculadas.
function computePayrollTotals(items) {
  return items.reduce(
    (acc, item) => ({
      totalIncome: acc.totalIncome.plus(item.totalIncome),
      totalDeductions: acc.totalDeductions.plus(item.totalDeductions),
      netTotal: acc.netTotal.plus(item.netPay),
    }),
    { totalIncome: new Decimal(0), totalDeductions: new Decimal(0), netTotal: new Decimal(0) }
  );
}

module.exports = {
  assertCanTransition,
  assertEditable,
  computeItemTotals,
  computePayrollTotals,
  sumBreakdown,
  EDITABLE_STATUSES,
};
