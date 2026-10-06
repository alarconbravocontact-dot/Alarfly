// Nómina: Borrador → Calculada → Revisada → Aprobada → Pagada.
// Nunca escribe JournalEntry directo (pasa por core/ledger) ni crea un
// mecanismo de pago propio (pasa por el PaymentOrder genérico de
// Tesorería, uno por empleado — cada empleado es un beneficiario
// distinto, igual que ya hace Tesorería con cualquier pago).
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const periodLockService = require('../../../core/period-lock/period-lock.service');
const { assertPeriodOpen } = require('../../../core/period-lock/period-lock.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');
const { assertDifferentActors } = require('../../../core/workflow/segregation.rules');
const personalSettingsService = require('./personal-settings.service');
const { assertCanTransition, assertEditable, computeItemTotals, computePayrollTotals } = require('./payroll.rules');
const paymentOrdersService = require('../../treasury/services/payment-orders.service');

async function createPayroll(companyId, userId, data) {
  return prisma.$transaction(async (tx) => {
    const payroll = await tx.payroll.create({ data: { companyId, createdByUserId: userId, ...data } });
    await auditService.log(
      { companyId, userId, action: 'payroll.created', entityType: 'Payroll', entityId: payroll.id, oldValue: null, newValue: { label: payroll.label, startDate: payroll.startDate, endDate: payroll.endDate } },
      tx
    );
    return payroll;
  });
}

async function getPayroll(companyId, id) {
  const payroll = await prisma.payroll.findFirst({
    where: { id, companyId },
    include: {
      items: {
        include: { employee: { select: { id: true, firstName: true, lastName: true, position: true } }, paymentOrder: { select: { id: true, status: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!payroll) {
    throw new AppError('La nómina indicada no existe.', 404, 'PAYROLL_NOT_FOUND');
  }
  return payroll;
}

async function listPayrolls(companyId, { status } = {}) {
  return prisma.payroll.findMany({
    where: { companyId, status: status || undefined },
    orderBy: { startDate: 'desc' },
    include: { _count: { select: { items: true } } },
  });
}

// "Calcular" (sección 7, paso 3): selecciona empleados ACTIVOS y crea
// (o reemplaza, si ya existían) una PayrollItem por cada uno, con el
// salario base congelado al momento de calcular — nunca se recalcula
// solo si el salario del empleado cambia después (sección 12).
async function calculatePayroll(companyId, id, userId, { employeeIds }) {
  const payroll = await prisma.payroll.findFirst({ where: { id, companyId } });
  if (!payroll) {
    throw new AppError('La nómina indicada no existe.', 404, 'PAYROLL_NOT_FOUND');
  }
  assertCanTransition(payroll.status, 'CALCULATED');

  const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds }, companyId, status: 'ACTIVE' } });
  if (employees.length !== employeeIds.length) {
    throw new AppError('Uno o más empleados indicados no existen o no están activos.', 400, 'EMPLOYEE_NOT_FOUND');
  }
  if (employees.length === 0) {
    throw new AppError('Selecciona al menos un empleado para calcular la nómina.', 400, 'NO_EMPLOYEES_SELECTED');
  }

  const itemsData = employees.map((employee) => {
    const totals = computeItemTotals(employee.baseSalary, null, null);
    return {
      payrollId: id,
      employeeId: employee.id,
      baseSalary: employee.baseSalary,
      incomeBreakdown: [],
      deductionBreakdown: [],
      totalIncome: totals.totalIncome,
      totalDeductions: totals.totalDeductions,
      netPay: totals.netPay,
    };
  });
  const payrollTotals = computePayrollTotals(itemsData);

  const updated = await prisma.$transaction(async (tx) => {
    // Recalcular reemplaza por completo la lista de líneas (igual
    // criterio que un asiento en borrador: se borra y se vuelve a
    // crear, nunca un merge parcial que pueda dejar líneas huérfanas).
    await tx.payrollItem.deleteMany({ where: { payrollId: id } });
    await tx.payrollItem.createMany({ data: itemsData });
    const result = await tx.payroll.update({
      where: { id },
      data: {
        status: 'CALCULATED',
        totalIncome: payrollTotals.totalIncome,
        totalDeductions: payrollTotals.totalDeductions,
        netTotal: payrollTotals.netTotal,
      },
    });
    await auditService.log(
      { companyId, userId, action: 'payroll.calculated', entityType: 'Payroll', entityId: id, oldValue: { status: payroll.status }, newValue: { status: 'CALCULATED', employeeCount: employees.length, netTotal: payrollTotals.netTotal } },
      tx
    );
    return result;
  });
  return updated;
}

// Edita el desglose de ingresos/deducciones de UN empleado dentro de
// una nómina todavía editable (Borrador/Calculada) — recalcula tanto
// esa línea como los totales agregados de la nómina completa.
async function updatePayrollItem(companyId, payrollId, itemId, userId, { incomeBreakdown, deductionBreakdown }) {
  const payroll = await prisma.payroll.findFirst({ where: { id: payrollId, companyId }, include: { items: true } });
  if (!payroll) {
    throw new AppError('La nómina indicada no existe.', 404, 'PAYROLL_NOT_FOUND');
  }
  assertEditable(payroll.status);
  const item = payroll.items.find((i) => i.id === itemId);
  if (!item) {
    throw new AppError('La línea de nómina indicada no existe.', 404, 'PAYROLL_ITEM_NOT_FOUND');
  }

  const totals = computeItemTotals(item.baseSalary, incomeBreakdown, deductionBreakdown);

  return prisma.$transaction(async (tx) => {
    const updatedItem = await tx.payrollItem.update({
      where: { id: itemId },
      data: { incomeBreakdown, deductionBreakdown, totalIncome: totals.totalIncome, totalDeductions: totals.totalDeductions, netPay: totals.netPay },
    });
    const allItems = payroll.items.map((i) => (i.id === itemId ? updatedItem : i));
    const payrollTotals = computePayrollTotals(allItems);
    await tx.payroll.update({ where: { id: payrollId }, data: payrollTotals });
    await auditService.log(
      { companyId, userId, action: 'payroll_item.updated', entityType: 'PayrollItem', entityId: itemId, oldValue: { incomeBreakdown: item.incomeBreakdown, deductionBreakdown: item.deductionBreakdown }, newValue: { incomeBreakdown, deductionBreakdown, netPay: totals.netPay } },
      tx
    );
    return updatedItem;
  });
}

async function transitionPayroll(companyId, id, userId, nextStatus, action) {
  const payroll = await prisma.payroll.findFirst({ where: { id, companyId } });
  if (!payroll) {
    throw new AppError('La nómina indicada no existe.', 404, 'PAYROLL_NOT_FOUND');
  }
  assertCanTransition(payroll.status, nextStatus);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payroll.update({ where: { id }, data: { status: nextStatus } });
    await auditService.log(
      { companyId, userId, action, entityType: 'Payroll', entityId: id, oldValue: { status: payroll.status }, newValue: { status: nextStatus } },
      tx
    );
    return updated;
  });
}

async function reviewPayroll(companyId, id, userId) {
  return transitionPayroll(companyId, id, userId, 'REVIEWED', 'payroll.reviewed');
}

async function sendBackToDraft(companyId, id, userId) {
  return transitionPayroll(companyId, id, userId, 'DRAFT', 'payroll.sent_back_to_draft');
}

async function sendBackToCalculated(companyId, id, userId) {
  return transitionPayroll(companyId, id, userId, 'CALCULATED', 'payroll.sent_back_to_calculated');
}

// Etiqueta la línea de débito de UN empleado con su FpaDimension
// (departamento/centro de costo) — mismo patrón exacto que
// inventory-movements.service.tagCogsLineWithProduct, generalizado:
// acá no hace falta "crear" la dimensión (los empleados no se auto-
// etiquetan como los productos, el usuario ya eligió una existente).
async function tagLineWithEmployeeDimension(tx, line, employee) {
  if (!employee.fpaDimensionId) return;
  await tx.journalEntryLineFpaDimension.create({ data: { lineId: line.id, fpaDimensionId: employee.fpaDimensionId } });
}

// Aprobar (sección 7, paso 5): postea el asiento de OBLIGACIÓN — Debe
// Gasto de Nómina (por el NETO a pagar, sección "Decisiones tomadas"
// de PERSONAL_MODULE_FINAL.md explica por qué no se modela un pasivo
// de retenciones separado), Haber Sueldos por Pagar — una línea de
// débito POR EMPLEADO (así cada una se puede etiquetar con su propia
// dimensión) y una sola línea de crédito agregada. Maker-checker: quien
// creó la nómina no puede ser quien la aprueba.
async function approvePayroll(companyId, id, userId) {
  const payroll = await prisma.payroll.findFirst({ where: { id, companyId }, include: { items: { include: { employee: true } } } });
  if (!payroll) {
    throw new AppError('La nómina indicada no existe.', 404, 'PAYROLL_NOT_FOUND');
  }
  assertCanTransition(payroll.status, 'APPROVED');
  if (payroll.items.length === 0) {
    throw new AppError('Esta nómina no tiene empleados calculados.', 400, 'PAYROLL_EMPTY');
  }
  assertDifferentActors(payroll.createdByUserId, userId, {
    message: 'Quien creó la nómina no puede aprobarla (maker-checker): debe hacerlo otra persona.',
  });

  const { expenseAccountId, payableAccountId } = await personalSettingsService.assertPayrollAccountsConfigured(companyId);
  const period = await periodLockService.getPeriodForDate(companyId, payroll.endDate);
  assertPeriodOpen(period);

  const lines = payroll.items.map((item) => ({
    accountId: expenseAccountId,
    debit: Number(item.netPay),
    credit: 0,
    dimensionIds: item.employee.branchDimensionId ? [item.employee.branchDimensionId] : undefined,
    description: `${item.employee.firstName} ${item.employee.lastName}`,
  }));
  lines.push({ accountId: payableAccountId, debit: 0, credit: Number(payroll.netTotal), description: payroll.label });

  const updated = await withTransaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: payroll.endDate,
        description: `Nómina ${payroll.label}`,
        lines,
        origin: 'AUTOMATIC',
        sourceModule: 'personal',
        sourceReference: id,
        createdByUserId: userId,
        autoApprove: true,
      },
      tx
    );

    // `lines[i]` se armó en el mismo orden que `payroll.items` (el
    // debito del empleado i va en `lines[i]`, el crédito agregado va al
    // final) — se empareja por `order` (el índice real que Prisma
    // guardó en cada línea), nunca por la posición del arreglo
    // devuelto, que no está garantizada.
    for (let i = 0; i < payroll.items.length; i += 1) {
      const line = entry.lines.find((l) => l.order === i);
      await tagLineWithEmployeeDimension(tx, line, payroll.items[i].employee);
    }

    const result = await tx.payroll.update({ where: { id }, data: { status: 'APPROVED', accrualJournalEntryId: entry.id } });
    await auditService.log(
      { companyId, userId, action: 'payroll.approved', entityType: 'Payroll', entityId: id, oldValue: { status: payroll.status }, newValue: { status: 'APPROVED', journalEntryId: entry.id } },
      tx
    );
    return result;
  });

  return updated;
}

// Pagar (sección 7, paso 6 / sección 11): crea UNA orden de pago
// genérica de Tesorería por empleado (cada quien es un beneficiario
// distinto) y la deja asociada a su línea. La nómina pasa a Pagada de
// inmediato — "pagada" significa que la obligación ya se entregó a
// Tesorería para su liquidación (documentado en PERSONAL_MODULE_FINAL.md);
// el propio flujo de aprobación de cada orden sigue viviendo, sin
// cambios, en Tesorería > Órdenes de Pago.
async function payPayroll(companyId, id, userId, { treasuryAccountId }) {
  const payroll = await prisma.payroll.findFirst({ where: { id, companyId }, include: { items: { include: { employee: true } } } });
  if (!payroll) {
    throw new AppError('La nómina indicada no existe.', 404, 'PAYROLL_NOT_FOUND');
  }
  // `assertCanTransition` solo bloquea un segundo pago DESPUÉS de que
  // los `requireRole`/payroll queden en PAID — pero si un intento
  // anterior falló a mitad del recorrido (una orden sí se creó para
  // el empleado 1, la del empleado 2 reventó), la nómina se queda en
  // APPROVED con ALGUNAS líneas ya pagadas. Reintentar "Pagar" debe
  // continuar donde se quedó, nunca duplicar la orden de un empleado
  // que ya tiene una.
  assertCanTransition(payroll.status, 'PAID');
  const { payableAccountId } = await personalSettingsService.assertPayrollAccountsConfigured(companyId);
  const pendingItems = payroll.items.filter((item) => !item.paymentOrderId);

  const paymentOrderIds = [];
  for (const item of pendingItems) {
    const order = await paymentOrdersService.createPaymentOrder(companyId, userId, {
      treasuryAccountId,
      glAccountId: payableAccountId,
      payeeName: `${item.employee.firstName} ${item.employee.lastName}`,
      amount: item.netPay,
      currency: payroll.currency,
      description: `Nómina ${payroll.label} — ${item.employee.firstName} ${item.employee.lastName}`,
      scheduledDate: payroll.paymentDate,
    });
    await prisma.payrollItem.update({ where: { id: item.id }, data: { paymentOrderId: order.id } });
    paymentOrderIds.push(order.id);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payroll.update({ where: { id }, data: { status: 'PAID' } });
    await auditService.log(
      { companyId, userId, action: 'payroll.paid', entityType: 'Payroll', entityId: id, oldValue: { status: payroll.status }, newValue: { status: 'PAID', paymentOrderIds } },
      tx
    );
    return result;
  });

  return updated;
}

module.exports = {
  createPayroll,
  getPayroll,
  listPayrolls,
  calculatePayroll,
  updatePayrollItem,
  reviewPayroll,
  sendBackToDraft,
  sendBackToCalculated,
  approvePayroll,
  payPayroll,
};
