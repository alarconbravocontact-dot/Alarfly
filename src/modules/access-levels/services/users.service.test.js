jest.mock('../../../core/database/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  userSession: {
    updateMany: jest.fn(),
  },
}));
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const usersService = require('./users.service');

describe('inviteUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Requisito explícito del usuario: el correo debe ser único, nunca
  // dos usuarios activos con el mismo correo.
  test('rechaza invitar a un correo que ya existe', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      usersService.inviteUser('company-1', 'admin-1', { email: 'ya@existe.com', name: 'Alguien', role: 'COLLABORATOR' })
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  // Requisito explícito del usuario: ningún rol puede superar su cupo
  // máximo (Contador 3, Financiero 4, Colaborador 8).
  test('rechaza invitar a un Contador cuando ya hay 3 activos (cupo máximo)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(3);

    await expect(
      usersService.inviteUser('company-1', 'admin-1', { email: 'nuevo@demo.com', name: 'Nuevo', role: 'ACCOUNTANT' })
    ).rejects.toMatchObject({ code: 'ROLE_QUOTA_EXCEEDED' });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('rechaza invitar a un Financiero cuando ya hay 4 activos (cupo máximo)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(4);

    await expect(
      usersService.inviteUser('company-1', 'admin-1', { email: 'nuevo@demo.com', name: 'Nuevo', role: 'FINANCE' })
    ).rejects.toMatchObject({ code: 'ROLE_QUOTA_EXCEEDED' });
  });

  test('rechaza invitar a un Colaborador cuando ya hay 8 activos (cupo máximo)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(8);

    await expect(
      usersService.inviteUser('company-1', 'admin-1', { email: 'nuevo@demo.com', name: 'Nuevo', role: 'COLLABORATOR' })
    ).rejects.toMatchObject({ code: 'ROLE_QUOTA_EXCEEDED' });
  });

  test('permite invitar a un Administrador sin límite de cupo', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(50);
    prisma.user.create.mockResolvedValue({ id: 'new-user', email: 'admin2@demo.com', role: 'ADMIN' });

    await expect(
      usersService.inviteUser('company-1', 'admin-1', { email: 'admin2@demo.com', name: 'Otro Admin', role: 'ADMIN' })
    ).resolves.toMatchObject({ user: { id: 'new-user' } });
  });

  test('permite invitar cuando todavía hay cupo disponible', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(2);
    prisma.user.create.mockResolvedValue({ id: 'new-user', email: 'nuevo@demo.com', role: 'ACCOUNTANT' });

    const result = await usersService.inviteUser('company-1', 'admin-1', {
      email: 'nuevo@demo.com',
      name: 'Nuevo',
      role: 'ACCOUNTANT',
    });

    expect(result.user.id).toBe('new-user');
    expect(result.invitationToken).toEqual(expect.any(String));
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });
});

describe('changeRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rechaza cambiar a un usuario activo a un rol ya lleno de cupo', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'target-1', role: 'COLLABORATOR', status: 'ACTIVE' });
    prisma.user.count.mockResolvedValue(3);

    await expect(usersService.changeRole('company-1', 'admin-1', 'target-1', 'ACCOUNTANT')).rejects.toMatchObject({
      code: 'ROLE_QUOTA_EXCEEDED',
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  // F15-E2: el rol viaja en el JWT — sin revocar la sesión, un cambio
  // de rol pensado para restringir a alguien no tenía ningún efecto
  // mientras su sesión ya abierta siguiera viva.
  test('revoca las sesiones activas del usuario al cambiarle el rol', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'target-1', role: 'COLLABORATOR', status: 'ACTIVE' });
    prisma.user.count.mockResolvedValue(0);
    prisma.user.update.mockResolvedValue({ id: 'target-1', role: 'FINANCE' });

    await usersService.changeRole('company-1', 'admin-1', 'target-1', 'FINANCE');

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'target-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  test('si el rol pedido es el mismo que ya tiene, no toca sesiones (early return)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'target-1', role: 'FINANCE', status: 'ACTIVE' });

    await usersService.changeRole('company-1', 'admin-1', 'target-1', 'FINANCE');

    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('deactivateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // F15-E2: requireAuth nunca revisaba User.isActive por fuera del
  // login — sin esto, un usuario recién desactivado seguía pudiendo
  // usar la API hasta que su token expirara solo.
  test('revoca las sesiones activas del usuario al desactivarlo', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'target-1', status: 'ACTIVE' });
    prisma.user.update.mockResolvedValue({ id: 'target-1', status: 'INACTIVE' });

    await usersService.deactivateUser('company-1', 'admin-1', 'target-1');

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'target-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  test('rechaza que un usuario se desactive a sí mismo, sin tocar sesiones', async () => {
    await expect(usersService.deactivateUser('company-1', 'admin-1', 'admin-1')).rejects.toMatchObject({
      code: 'CANNOT_DEACTIVATE_SELF',
    });

    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });
});
