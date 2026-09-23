jest.mock('../database/prisma', () => ({
  user: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
  userSession: { create: jest.fn() },
}));
jest.mock('../audit/audit.service', () => ({ log: jest.fn() }));
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn(async (v) => `hashed:${v}`) }));

const bcrypt = require('bcryptjs');
const prisma = require('../database/prisma');
const authService = require('./auth.service');

describe('acceptInvitation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Requisito explícito del usuario: el cupo se revisa siempre en el
  // backend. Este es el punto donde una invitación se vuelve un
  // usuario ACTIVO — si no se revalida acá, alguien podría invitar de
  // más (las invitaciones pendientes no cuentan como activas) y luego
  // dejar que todas se acepten, superando el cupo del rol.
  test('rechaza aceptar la invitación si el rol ya no tiene cupo disponible', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      companyId: 'company-1',
      role: 'ACCOUNTANT',
      status: 'INVITED',
      invitationExpiresAt: new Date(Date.now() + 100000),
    });
    prisma.user.count.mockResolvedValue(3); // cupo de ACCOUNTANT ya lleno

    await expect(authService.acceptInvitation('token-1', 'unaClaveSegura1')).rejects.toMatchObject({
      code: 'ROLE_QUOTA_EXCEEDED',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('permite aceptar la invitación si todavía hay cupo', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      companyId: 'company-1',
      role: 'ACCOUNTANT',
      status: 'INVITED',
      invitationExpiresAt: new Date(Date.now() + 100000),
    });
    prisma.user.count.mockResolvedValue(1);
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      companyId: 'company-1',
      name: 'Nuevo',
      email: 'nuevo@demo.com',
      role: 'ACCOUNTANT',
    });
    prisma.userSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await authService.acceptInvitation('token-1', 'unaClaveSegura1');
    expect(result.token).toEqual(expect.any(String));
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  test('rechaza un token que no corresponde a una invitación pendiente', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(authService.acceptInvitation('token-invalido', 'unaClaveSegura1')).rejects.toMatchObject({
      code: 'INVALID_INVITATION',
    });
  });

  test('rechaza un token de invitación vencido', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      companyId: 'company-1',
      role: 'COLLABORATOR',
      status: 'INVITED',
      invitationExpiresAt: new Date(Date.now() - 1000),
    });
    await expect(authService.acceptInvitation('token-1', 'unaClaveSegura1')).rejects.toMatchObject({
      code: 'INVITATION_EXPIRED',
    });
  });
});

// Mi Cuenta, punto 3: el 2FA solo tiene valor si de verdad bloquea el
// login — estos tests confirman que un usuario con 2FA activo NUNCA
// recibe una sesión completa directo desde login(), y uno sin 2FA sí.
describe('login (segundo paso de 2FA)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('un usuario con 2FA activo recibe un token pendiente, no una sesión', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      companyId: 'company-1',
      role: 'ADMIN',
      isActive: true,
      passwordHash: 'hash',
      twoFactorEnabled: true,
    });
    bcrypt.compare.mockResolvedValue(true);

    const result = await authService.login('admin@demo.com', 'clave');

    expect(result.requiresTwoFactor).toBe(true);
    expect(result.pendingToken).toEqual(expect.any(String));
    expect(result.token).toBeUndefined();
    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });

  test('un usuario sin 2FA recibe la sesión completa como siempre', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      companyId: 'company-1',
      role: 'ADMIN',
      isActive: true,
      passwordHash: 'hash',
      twoFactorEnabled: false,
    });
    bcrypt.compare.mockResolvedValue(true);
    prisma.userSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await authService.login('admin@demo.com', 'clave');

    expect(result.requiresTwoFactor).toBeUndefined();
    expect(result.token).toEqual(expect.any(String));
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
  });
});
