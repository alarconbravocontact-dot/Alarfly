// Ficha del Empleado (sección 6 del prompt del módulo): concentra todo
// lo relevante de una persona en una sola lectura — nunca obliga a
// entrar a Nómina y a Gastos por separado para entender su situación.
// Estrictamente de solo lectura, igual criterio que Reportes/FP&A: no
// escribe nada, solo agrega datos que ya existen en otras tablas.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const auditService = require('../../../core/audit/audit.service');
const employeesService = require('./employees.service');

const { Decimal } = Prisma;

// Etiquetas legibles por acción — mismo criterio que ya usa la línea de
// tiempo de facturas de AR: el frontend reutiliza `core/ui/
// DocumentTimeline.jsx` tal cual, que espera {auditLogId, label, date,
// userName, relatedDocument}, nunca la fila cruda de AuditLog.
const ACTION_LABELS = {
  'employee.created': 'Empleado creado',
  'employee.updated': 'Datos actualizados',
  'employee.sensitive_info_updated': 'Información sensible actualizada',
  'payroll.created': 'Nómina creada',
  'payroll.calculated': 'Nómina calculada',
  'payroll.reviewed': 'Nómina revisada',
  'payroll.sent_back_to_draft': 'Nómina devuelta a borrador',
  'payroll.sent_back_to_calculated': 'Nómina devuelta a calculada',
  'payroll.approved': 'Nómina aprobada',
  'payroll.paid': 'Nómina pagada',
  'payroll_item.updated': 'Línea de nómina editada',
  'employee_expense.registered': 'Gasto registrado',
  'employee_expense.approved': 'Gasto aprobado',
  'employee_expense.rejected': 'Gasto rechazado',
  'employee_expense.reimbursed': 'Gasto reembolsado',
};

function toTimelineSteps(auditLogs) {
  return auditLogs.map((log) => ({
    auditLogId: log.id,
    label: ACTION_LABELS[log.action] || log.action,
    date: log.createdAt,
    userName: log.user?.name || 'Sistema',
    relatedDocument: log.entityType !== 'Employee' ? log.entityType : undefined,
  }));
}

async function getFicha(companyId, employeeId) {
  const employee = await employeesService.getEmployee(companyId, employeeId);

  const [payrollItems, expenses] = await Promise.all([
    prisma.payrollItem.findMany({
      where: { employeeId, payroll: { companyId } },
      include: { payroll: { select: { id: true, label: true, status: true, paymentDate: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.employeeExpense.findMany({ where: { employeeId, companyId }, orderBy: { expenseDate: 'desc' } }),
  ]);

  const paidItems = payrollItems.filter((item) => item.payroll.status === 'PAID');
  const totalPaid = paidItems.reduce((sum, item) => sum.plus(item.netPay), new Decimal(0));
  const lastPayrollItem = payrollItems[0] || null;

  // Historial real: audit log del empleado + de cada nómina/gasto donde
  // participó — nunca un evento inventado, siempre filas reales de
  // AuditLog (mismo patrón que la línea de tiempo de una factura de AR).
  const refs = [
    { entityType: 'Employee', entityId: employeeId },
    ...payrollItems.map((item) => ({ entityType: 'Payroll', entityId: item.payrollId })),
    ...expenses.map((expense) => ({ entityType: 'EmployeeExpense', entityId: expense.id })),
  ];
  const auditLogs = await auditService.listForEntities(companyId, refs);
  const timelineSteps = toTimelineSteps(auditLogs);

  return {
    employee,
    summary: {
      status: employee.status,
      hireDate: employee.hireDate,
      currentSalary: employee.baseSalary,
      currency: employee.currency,
      lastPayroll: lastPayrollItem
        ? { payrollId: lastPayrollItem.payrollId, label: lastPayrollItem.payroll.label, netPay: lastPayrollItem.netPay, status: lastPayrollItem.payroll.status }
        : null,
      totalPaid,
      pendingExpenses: expenses.filter((expense) => expense.status === 'PENDING_APPROVAL').length,
    },
    payrollItems,
    expenses,
    timelineSteps,
  };
}

module.exports = { getFicha };
