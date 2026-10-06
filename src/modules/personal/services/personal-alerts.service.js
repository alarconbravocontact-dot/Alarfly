// Integración con el motor de alertas ya existente (core/alerts, el
// mismo que usan Tesorería/Fiscal/Inventario/AR/Análisis Avanzados) —
// nunca un motor nuevo. Mismo patrón "escanear y reconciliar" que ya
// usa `ar-collections.service.scanOverdueInvoices`/
// `inventory-alerts.service.scanLowStock`: no requiere un `AlertRule`
// configurado antes (no hay ningún umbral que el Administrador deba
// ajustar — "está en este estado o no lo está", mismo criterio que
// `treasury/alerts.service.scanDisconnectedBankAccounts`), se dispara
// una alerta por documento (nunca duplicada mientras siga activa,
// `createAlertIfNotExists`), y se resuelve cuando el Administrador la
// marca atendida desde la campana de notificaciones — igual que el
// resto de alertas de tipo "escaneo" del proyecto (no hay resolución
// automática síncrona: `APPROVAL_PENDING` sí la tiene porque nace de
// una acción directa del usuario en Tesorería; esto nace de un cron).
const prisma = require('../../../core/database/prisma');
const coreAlertsService = require('../../../core/alerts/alerts.service');

async function scanPendingActions(companyId) {
  const [reviewedPayrolls, approvedPayrolls, pendingExpenses, approvedExpenses] = await Promise.all([
    prisma.payroll.findMany({ where: { companyId, status: 'REVIEWED' } }),
    prisma.payroll.findMany({ where: { companyId, status: 'APPROVED' }, include: { items: true } }),
    prisma.employeeExpense.findMany({ where: { companyId, status: 'PENDING_APPROVAL' }, include: { employee: true } }),
    prisma.employeeExpense.findMany({ where: { companyId, status: 'APPROVED' }, include: { employee: true } }),
  ]);

  const created = [];

  for (const payroll of reviewedPayrolls) {
    const alert = await coreAlertsService.createAlertIfNotExists({
      companyId,
      ruleId: null,
      type: 'PAYROLL_ACTION_PENDING',
      severity: 'WARNING',
      message: `La nómina "${payroll.label}" ya fue calculada y revisada — está lista para aprobar (${Number(payroll.netTotal).toFixed(2)} ${payroll.currency}).`,
      entityType: 'Payroll',
      entityId: `${payroll.id}:review`,
    });
    if (alert) created.push(alert);
  }

  for (const payroll of approvedPayrolls) {
    // Reintentar "Pagar" solo crea órdenes para los ítems que faltan
    // (ver payroll.service.payPayroll) — una nómina APPROVED con TODOS
    // sus ítems ya ligados a una PaymentOrder no necesita esta alerta,
    // aunque técnicamente siga en estado APPROVED hasta que la
    // respuesta de Tesorería complete el último nivel.
    const stillPending = payroll.items.some((item) => !item.paymentOrderId);
    if (!stillPending) continue;
    const alert = await coreAlertsService.createAlertIfNotExists({
      companyId,
      ruleId: null,
      type: 'PAYROLL_ACTION_PENDING',
      severity: 'WARNING',
      message: `La nómina "${payroll.label}" ya está aprobada y pendiente de pago (${Number(payroll.netTotal).toFixed(2)} ${payroll.currency}).`,
      entityType: 'Payroll',
      entityId: `${payroll.id}:payment`,
    });
    if (alert) created.push(alert);
  }

  for (const expense of pendingExpenses) {
    const alert = await coreAlertsService.createAlertIfNotExists({
      companyId,
      ruleId: null,
      type: 'EMPLOYEE_EXPENSE_ACTION_PENDING',
      severity: 'INFO',
      message: `Gasto de ${expense.employee.firstName} ${expense.employee.lastName} por ${Number(expense.amount).toFixed(2)} ${expense.currency} pendiente de revisión.`,
      entityType: 'EmployeeExpense',
      entityId: `${expense.id}:review`,
    });
    if (alert) created.push(alert);
  }

  for (const expense of approvedExpenses) {
    const alert = await coreAlertsService.createAlertIfNotExists({
      companyId,
      ruleId: null,
      type: 'EMPLOYEE_EXPENSE_ACTION_PENDING',
      severity: 'WARNING',
      message: `Gasto de ${expense.employee.firstName} ${expense.employee.lastName} por ${Number(expense.amount).toFixed(2)} ${expense.currency} ya aprobado, pendiente de reembolso.`,
      entityType: 'EmployeeExpense',
      entityId: `${expense.id}:reimbursement`,
    });
    if (alert) created.push(alert);
  }

  return created;
}

module.exports = { scanPendingActions };
