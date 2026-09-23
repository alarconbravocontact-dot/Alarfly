jest.mock('../database/prisma', () => ({
  userSession: { findUnique: jest.fn(), update: jest.fn(() => Promise.resolve()) },
}));

const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../database/prisma');
const { requireAuth } = require('./auth.middleware');

function mockReqRes(token) {
  return {
    req: { headers: { authorization: token ? `Bearer ${token}` : '' } },
    res: {},
    next: jest.fn(),
  };
}

function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

describe('requireAuth (sesiones reales)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deja pasar un token sin sessionId (compatibilidad con tokens viejos)', async () => {
    const token = signToken({ userId: 'u1', companyId: 'c1', role: 'ADMIN' });
    const { req, res, next } = mockReqRes(token);
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
  });

  test('deja pasar un token con una sesión activa', async () => {
    prisma.userSession.findUnique.mockResolvedValue({ id: 's1', userId: 'u1', revokedAt: null });
    const token = signToken({ userId: 'u1', companyId: 'c1', role: 'ADMIN', sessionId: 's1' });
    const { req, res, next } = mockReqRes(token);
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.auth.sessionId).toBe('s1');
  });

  // Esto es lo que hace real "cerrar sesión remota" (Mi Cuenta, punto 7):
  // una sesión revocada deja de servir para autenticar, aunque el JWT
  // en sí todavía no haya expirado.
  test('rechaza un token cuya sesión ya fue revocada', async () => {
    prisma.userSession.findUnique.mockResolvedValue({ id: 's1', userId: 'u1', revokedAt: new Date() });
    const token = signToken({ userId: 'u1', companyId: 'c1', role: 'ADMIN', sessionId: 's1' });
    const { req, res, next } = mockReqRes(token);
    await requireAuth(req, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SESSION_REVOKED' });
  });

  test('rechaza un token cuya sesión ya no existe', async () => {
    prisma.userSession.findUnique.mockResolvedValue(null);
    const token = signToken({ userId: 'u1', companyId: 'c1', role: 'ADMIN', sessionId: 's1' });
    const { req, res, next } = mockReqRes(token);
    await requireAuth(req, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SESSION_REVOKED' });
  });

  test('rechaza sin encabezado de autorización', async () => {
    const { req, res, next } = mockReqRes(null);
    await requireAuth(req, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'NOT_AUTHENTICATED' });
  });

  test('rechaza un token inválido', async () => {
    const { req, res, next } = mockReqRes('esto-no-es-un-jwt');
    await requireAuth(req, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'INVALID_TOKEN' });
  });
});
