// Confirma que las obligaciones de Personal (nómina/gastos pendientes
// de una acción) se agrupan por el estado correcto — es la fuente que
// alimenta tanto el widget del Inicio como la sección nueva de
// Finanzas (sección 2 y 3 del pedido de integración).
jest.mock('../../../core/database/prisma', () => ({
  payroll: { findMany: jest.fn() },
  employeeExpense: { findMany: jest.fn() },
  employee: { count: jest.fn() },
}));

const prisma = require('../../../core/database/prisma');
const { getObligationsSummary } = require('./personal-dashboard.service');

describe('personal-dashboard.service.getObligationsSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  test('agrupa nómina REVIEWED/APPROVED y gastos PENDING_APPROVAL/APPROVED por separado, con sus totales', async () => {
    prisma.payroll.findMany
      .mockResolvedValueOnce([{ id: 'p1', label: 'R1', netTotal: 100 }]) // REVIEWED
      .mockResolvedValueOnce([
        { id: 'p2', label: 'A1', netTotal: 200 },
        { id: 'p3', label: 'A2', netTotal: 300 },
      ]); // APPROVED
    prisma.employeeExpense.findMany
      .mockResolvedValueOnce([{ id: 'e1', amount: 10, employee: { firstName: 'A', lastName: 'B' } }]) // PENDING_APPROVAL
      .mockResolvedValueOnce([{ id: 'e2', amount: 20, employee: { firstName: 'C', lastName: 'D' } }]); // APPROVED

    const summary = await getObligationsSummary('company-1');

    expect(summary.payrollPendingApproval).toMatchObject({ count: 1 });
    expect(summary.payrollPendingApproval.total.toFixed(2)).toBe('100.00');
    expect(summary.payrollPendingPayment).toMatchObject({ count: 2 });
    expect(summary.payrollPendingPayment.total.toFixed(2)).toBe('500.00');
    expect(summary.expensesPendingReview.total.toFixed(2)).toBe('10.00');
    expect(summary.expensesPendingReimbursement.total.toFixed(2)).toBe('20.00');
  });

  test('sin nada pendiente, todos los totales dan 0 (nunca null ni undefined)', async () => {
    prisma.payroll.findMany.mockResolvedValue([]);
    prisma.employeeExpense.findMany.mockResolvedValue([]);

    const summary = await getObligationsSummary('company-1');

    expect(summary.payrollPendingApproval.total.toFixed(2)).toBe('0.00');
    expect(summary.payrollPendingPayment.count).toBe(0);
    expect(summary.expensesPendingReview.count).toBe(0);
    expect(summary.expensesPendingReimbursement.count).toBe(0);
  });
});
