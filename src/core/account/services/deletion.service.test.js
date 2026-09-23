jest.mock('../../database/prisma', () => ({
  accountDeletionRequest: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  user: { update: jest.fn() },
  $transaction: jest.fn((fn) =>
    fn({
      accountDeletionRequest: { update: jest.fn(async (args) => ({ id: 'req-1', status: args.data.status })) },
      user: { update: jest.fn() },
    })
  ),
}));
jest.mock('../../audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../database/prisma');
const deletionService = require('./deletion.service');

describe('requestDeletion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza una segunda solicitud mientras la primera sigue pendiente', async () => {
    prisma.accountDeletionRequest.findFirst.mockResolvedValue({ id: 'req-existente', status: 'PENDING' });

    await expect(deletionService.requestDeletion('c1', 'u1', 'ya no trabajo aquí')).rejects.toMatchObject({
      code: 'DELETION_ALREADY_PENDING',
    });
    expect(prisma.accountDeletionRequest.create).not.toHaveBeenCalled();
  });

  test('permite solicitar la baja si no hay una pendiente', async () => {
    prisma.accountDeletionRequest.findFirst.mockResolvedValue(null);
    prisma.accountDeletionRequest.create.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

    const result = await deletionService.requestDeletion('c1', 'u1', 'motivo');
    expect(result.id).toBe('req-1');
  });
});

describe('decideDeletion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza decidir una solicitud que ya no está pendiente', async () => {
    prisma.accountDeletionRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'APPROVED', userId: 'u1' });

    await expect(deletionService.decideDeletion('c1', 'admin-1', 'req-1', { approve: true })).rejects.toMatchObject({
      code: 'DELETION_ALREADY_DECIDED',
    });
  });

  test('rechaza si la solicitud no existe', async () => {
    prisma.accountDeletionRequest.findFirst.mockResolvedValue(null);

    await expect(deletionService.decideDeletion('c1', 'admin-1', 'req-inexistente', { approve: true })).rejects.toMatchObject({
      code: 'DELETION_REQUEST_NOT_FOUND',
    });
  });
});
