jest.mock('../../database/prisma', () => ({
  user: { findUnique: jest.fn(), update: jest.fn() },
  userSession: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
}));
jest.mock('../../audit/audit.service', () => ({ log: jest.fn() }));
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn(async (v) => `hashed:${v}`) }));

const bcrypt = require('bcryptjs');
const prisma = require('../../database/prisma');
const securityService = require('./security.service');

describe('changePassword', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza si la contraseña actual no coincide', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hash-viejo' });
    bcrypt.compare.mockResolvedValue(false);

    await expect(securityService.changePassword('u1', 'c1', 'incorrecta', 'Clave1234')).rejects.toMatchObject({
      code: 'CURRENT_PASSWORD_INCORRECT',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('actualiza la contraseña cuando la actual es correcta', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hash-viejo' });
    bcrypt.compare.mockResolvedValue(true);

    await securityService.changePassword('u1', 'c1', 'correcta', 'Clave1234');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordHash: 'hashed:Clave1234' } });
  });
});

describe('revokeSession', () => {
  beforeEach(() => jest.clearAllMocks());

  // Nunca se puede revocar la sesión de OTRO usuario — el filtro por
  // userId en el findFirst es lo que garantiza esto.
  test('rechaza si la sesión no pertenece al usuario (o no existe)', async () => {
    prisma.userSession.findFirst.mockResolvedValue(null);

    await expect(securityService.revokeSession('u1', 'c1', 'session-de-otro')).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
    });
    expect(prisma.userSession.update).not.toHaveBeenCalled();
  });

  test('revoca una sesión propia activa', async () => {
    prisma.userSession.findFirst.mockResolvedValue({ id: 's1', userId: 'u1', revokedAt: null });
    prisma.userSession.update.mockResolvedValue({ id: 's1', revokedAt: new Date() });

    await securityService.revokeSession('u1', 'c1', 's1');
    expect(prisma.userSession.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { revokedAt: expect.any(Date) } });
  });

  test('no falla al revocar una sesión que ya estaba revocada (idempotente)', async () => {
    const already = { id: 's1', userId: 'u1', revokedAt: new Date() };
    prisma.userSession.findFirst.mockResolvedValue(already);

    const result = await securityService.revokeSession('u1', 'c1', 's1');
    expect(result).toBe(already);
    expect(prisma.userSession.update).not.toHaveBeenCalled();
  });
});

describe('disableTwoFactor', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza si el usuario no tiene 2FA activo', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', twoFactorEnabled: false });

    await expect(securityService.disableTwoFactor('u1', 'c1', 'clave', '123456')).rejects.toMatchObject({
      code: 'TWO_FACTOR_NOT_ENABLED',
    });
  });

  test('rechaza si la contraseña es incorrecta', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      twoFactorEnabled: true,
      passwordHash: 'hash',
      twoFactorSecretEncrypted: 'irrelevante',
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(securityService.disableTwoFactor('u1', 'c1', 'clave-mala', '123456')).rejects.toMatchObject({
      code: 'CURRENT_PASSWORD_INCORRECT',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
