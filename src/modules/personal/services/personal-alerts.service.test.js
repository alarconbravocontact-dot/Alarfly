// Integración transversal: confirma que el escaneo crea el tipo/
// severidad correctos para cada uno de los 4 casos (sección 11 del
// pedido de integración), y que una nómina APPROVED con TODOS sus
// ítems ya ligados a una PaymentOrder no genera una alerta de
// "pendiente de pago" redundante (evita duplicar la señal de lo que
// Tesorería ya está procesando).
jest.mock('../../../core/database/prisma', () => ({
  payroll: { findMany: jest.fn() },
  employeeExpense: { findMany: jest.fn() },
}));
jest.mock('../../../core/alerts/alerts.service', () => ({ createAlertIfNotExists: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const coreAlertsService = require('../../../core/alerts/alerts.service');
const { scanPendingActions } = require('./personal-alerts.service');

describe('personal-alerts.service.scanPendingActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payroll.findMany.mockResolvedValue([]);
    prisma.employeeExpense.findMany.mockResolvedValue([]);
    coreAlertsService.createAlertIfNotExists.mockResolvedValue({ id: 'alert-1' });
  });

  test('crea PAYROLL_ACTION_PENDING (WARNING) para una nómina REVIEWED', async () => {
    prisma.payroll.findMany
      .mockResolvedValueOnce([{ id: 'p1', label: 'Octubre 2026', netTotal: 1500, currency: 'USD' }]) // REVIEWED
      .mockResolvedValueOnce([]); // APPROVED

    await scanPendingActions('company-1');

    expect(coreAlertsService.createAlertIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-1', type: 'PAYROLL_ACTION_PENDING', severity: 'WARNING', entityId: 'p1:review' })
    );
  });

  test('crea PAYROLL_ACTION_PENDING para una nómina APPROVED con ítems sin PaymentOrder', async () => {
    prisma.payroll.findMany
      .mockResolvedValueOnce([]) // REVIEWED
      .mockResolvedValueOnce([
        { id: 'p2', label: 'Octubre 2026', netTotal: 2000, currency: 'USD', items: [{ paymentOrderId: null }, { paymentOrderId: 'po-1' }] },
      ]); // APPROVED

    await scanPendingActions('company-1');

    expect(coreAlertsService.createAlertIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAYROLL_ACTION_PENDING', entityId: 'p2:payment' })
    );
  });

  test('NO crea alerta de pago para una nómina APPROVED cuyos ítems ya tienen PaymentOrder', async () => {
    prisma.payroll.findMany
      .mockResolvedValueOnce([]) // REVIEWED
      .mockResolvedValueOnce([{ id: 'p3', label: 'Septiembre 2026', netTotal: 900, currency: 'USD', items: [{ paymentOrderId: 'po-1' }] }]); // APPROVED

    await scanPendingActions('company-1');

    expect(coreAlertsService.createAlertIfNotExists).not.toHaveBeenCalled();
  });

  test('crea EMPLOYEE_EXPENSE_ACTION_PENDING (INFO) para un gasto PENDING_APPROVAL y (WARNING) para uno APPROVED', async () => {
    prisma.employeeExpense.findMany
      .mockResolvedValueOnce([{ id: 'e1', amount: 50, currency: 'USD', employee: { firstName: 'Marta', lastName: 'Díaz' } }]) // PENDING_APPROVAL
      .mockResolvedValueOnce([{ id: 'e2', amount: 80, currency: 'USD', employee: { firstName: 'Laura', lastName: 'Gómez' } }]); // APPROVED

    await scanPendingActions('company-1');

    expect(coreAlertsService.createAlertIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EMPLOYEE_EXPENSE_ACTION_PENDING', severity: 'INFO', entityId: 'e1:review' })
    );
    expect(coreAlertsService.createAlertIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EMPLOYEE_EXPENSE_ACTION_PENDING', severity: 'WARNING', entityId: 'e2:reimbursement' })
    );
  });

  test('sin ninguna nómina/gasto pendiente, no crea ninguna alerta', async () => {
    const created = await scanPendingActions('company-1');
    expect(coreAlertsService.createAlertIfNotExists).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });
});
