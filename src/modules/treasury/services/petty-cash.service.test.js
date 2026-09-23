jest.mock('../../../core/database/prisma', () => ({
  pettyCashExpense: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn((cb) => cb({ pettyCashExpense: { update: jest.fn().mockResolvedValue({ id: 'mock', status: 'REJECTED' }) } })),
}));
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const pettyCashService = require('./petty-cash.service');

// bulkDecideExpenses (Feature P: barra de acciones masivas): NUNCA
// reimplementa el maker-checker — cada id pasa por la MISMA
// `decideExpense` de siempre. Estos tests confirman que un lote mixto
// (algunos gastos elegibles, otros no) se procesa entero sin que un id
// no elegible bloquee a los demás, y que el motivo reportado es
// exactamente el mismo mensaje que ya usa la aprobación individual.
describe('petty-cash.service.bulkDecideExpenses', () => {
  beforeEach(() => jest.clearAllMocks());

  test('procesa cada gasto de forma independiente: resuelve los elegibles y reporta por qué se saltó cada uno de los no elegibles', async () => {
    const byId = {
      e1: { id: 'e1', status: 'PENDING_APPROVAL', registeredByUserId: 'empleado1', fund: {} },
      e2: { id: 'e2', status: 'APPROVED', registeredByUserId: 'empleado1', fund: {} },
      e3: { id: 'e3', status: 'PENDING_APPROVAL', registeredByUserId: 'supervisor1', fund: {} },
    };
    prisma.pettyCashExpense.findFirst.mockImplementation(({ where }) => Promise.resolve(byId[where.id] || null));
    prisma.user.findUnique.mockResolvedValue({ id: 'supervisor1', role: 'ADMIN' });

    const results = await pettyCashService.bulkDecideExpenses('c1', ['e1', 'e2', 'e3'], 'supervisor1', {
      decision: 'REJECTED',
      rejectionReason: 'Sin comprobante',
    });

    expect(results).toEqual([
      { id: 'e1', status: 'done' },
      { id: 'e2', status: 'skipped', reason: expect.stringContaining('pendiente') },
      { id: 'e3', status: 'skipped', reason: expect.stringContaining('maker-checker') },
    ]);
  });

  test('un lote donde todos son elegibles no reporta ningún saltado', async () => {
    prisma.pettyCashExpense.findFirst.mockResolvedValue({ id: 'e1', status: 'PENDING_APPROVAL', registeredByUserId: 'empleado1', fund: {} });
    prisma.user.findUnique.mockResolvedValue({ id: 'supervisor1', role: 'ADMIN' });

    const results = await pettyCashService.bulkDecideExpenses('c1', ['e1'], 'supervisor1', { decision: 'REJECTED' });

    expect(results).toEqual([{ id: 'e1', status: 'done' }]);
  });

  test('un gasto inexistente se reporta como saltado, sin tumbar el resto del lote', async () => {
    prisma.pettyCashExpense.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(where.id === 'e1' ? { id: 'e1', status: 'PENDING_APPROVAL', registeredByUserId: 'empleado1', fund: {} } : null)
    );
    prisma.user.findUnique.mockResolvedValue({ id: 'supervisor1', role: 'ADMIN' });

    const results = await pettyCashService.bulkDecideExpenses('c1', ['no-existe', 'e1'], 'supervisor1', { decision: 'REJECTED' });

    expect(results).toEqual([
      { id: 'no-existe', status: 'skipped', reason: expect.stringContaining('no existe') },
      { id: 'e1', status: 'done' },
    ]);
  });
});
