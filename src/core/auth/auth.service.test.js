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

// F15-E3: login() nunca limitaba intentos fallidos — cualquiera podía
// probar contraseñas sin límite. Estos tests cubren el contador, el
// bloqueo al quinto fallo consecutivo, el rechazo mientras sigue
// bloqueada, y que un login correcto reinicia todo.
describe('login (bloqueo por intentos fallidos)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('una contraseña incorrecta incrementa el contador sin bloquear todavía', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: 'hash',
      failedLoginAttempts: 2,
      lockedUntil: null,
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login('admin@demo.com', 'mala')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: 3, lockedUntil: null },
    });
  });

  test('el 5to intento fallido consecutivo bloquea la cuenta 15 minutos', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: 'hash',
      failedLoginAttempts: 4,
      lockedUntil: null,
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login('admin@demo.com', 'mala')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: 0, lockedUntil: expect.any(Date) },
    });
  });

  test('una cuenta bloqueada rechaza el login (incluso con la contraseña correcta) sin ni siquiera comparar la contraseña', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: 'hash',
      failedLoginAttempts: 0,
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
    });

    await expect(authService.login('admin@demo.com', 'lo-que-sea')).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
      statusCode: 429,
    });

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('pasado el tiempo de bloqueo, el login vuelve a evaluarse normalmente', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: 'hash',
      failedLoginAttempts: 0,
      lockedUntil: new Date(Date.now() - 1000), // ya venció
      twoFactorEnabled: false,
    });
    bcrypt.compare.mockResolvedValue(true);
    prisma.userSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await authService.login('admin@demo.com', 'clave-correcta');

    expect(result.token).toEqual(expect.any(String));
  });

  test('un login correcto reinicia el contador de intentos fallidos', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: 'hash',
      failedLoginAttempts: 3,
      lockedUntil: null,
      twoFactorEnabled: false,
    });
    bcrypt.compare.mockResolvedValue(true);
    prisma.userSession.create.mockResolvedValue({ id: 'session-1' });

    await authService.login('admin@demo.com', 'clave-correcta');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  test('un login correcto sin ningún intento fallido previo no llama a update de más', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: 'hash',
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
    });
    bcrypt.compare.mockResolvedValue(true);
    prisma.userSession.create.mockResolvedValue({ id: 'session-1' });

    await authService.login('admin@demo.com', 'clave-correcta');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
