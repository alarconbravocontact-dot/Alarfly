jest.mock('./delegated-permissions.service');

const { requireModuleAccess, requireAccessManagement } = require('./rbac.middleware');
const delegatedPermissionsService = require('./delegated-permissions.service');

function mockReqRes(auth) {
  return { req: { auth }, res: {}, next: jest.fn() };
}

describe('requireModuleAccess', () => {
  test('deja pasar un rol permitido para el módulo', () => {
    const middleware = requireModuleAccess('inventory');
    const { req, res, next } = mockReqRes({ role: 'COLLABORATOR' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rechaza un rol sin acceso a ese módulo', () => {
    const middleware = requireModuleAccess('fpa'); // FP&A: solo ADMIN/FINANCE
    const { req, res, next } = mockReqRes({ role: 'COLLABORATOR' });
    expect(() => middleware(req, res, next)).toThrow('No tienes acceso a este módulo con tu rol actual.');
    expect(next).not.toHaveBeenCalled();
  });

  test('rechaza si no hay sesión', () => {
    const middleware = requireModuleAccess('accounting');
    const { req, res, next } = mockReqRes(undefined);
    expect(() => middleware(req, res, next)).toThrow();
    expect(next).not.toHaveBeenCalled();
  });
});

// Estos tests cubren exactamente lo pedido explícitamente por el
// usuario: un usuario sin rol Administrador (ni permiso delegado) no
// puede entrar a Niveles de Acceso.
describe('requireAccessManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // requireAccessManagement está envuelto con asyncHandler (ver
  // rbac.middleware.js): un error se entrega a next(err), nunca como
  // una promesa rechazada — si no fuera así, un throw dentro de un
  // middleware async se vuelve una excepción no manejada que tumba
  // el proceso de Node entero en vez de responder 403 (bug real
  // encontrado probando el flujo a mano contra el servidor real).

  test('el Administrador siempre entra', async () => {
    const { req, res, next } = mockReqRes({ role: 'ADMIN' });
    await requireAccessManagement(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // sin argumentos: sigue de largo, no es un error
    expect(delegatedPermissionsService.hasActivePermission).not.toHaveBeenCalled();
  });

  test('un Contador sin permiso delegado es rechazado', async () => {
    delegatedPermissionsService.hasActivePermission.mockResolvedValue(false);
    const { req, res, next } = mockReqRes({ role: 'ACCOUNTANT', companyId: 'c1', userId: 'u1' });
    await requireAccessManagement(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.message).toBe('Solo el Administrador puede entrar a Niveles de Acceso.');
    expect(err.code).toBe('FORBIDDEN');
  });

  test('un Contador CON permiso delegado sí entra', async () => {
    delegatedPermissionsService.hasActivePermission.mockResolvedValue(true);
    const { req, res, next } = mockReqRes({ role: 'ACCOUNTANT', companyId: 'c1', userId: 'u1' });
    await requireAccessManagement(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('Financiero es rechazado (el permiso delegado solo aplica a Contador)', async () => {
    const { req, res, next } = mockReqRes({ role: 'FINANCE', companyId: 'c1', userId: 'u1' });
    await requireAccessManagement(req, res, next);
    expect(next.mock.calls[0][0]).toBeDefined();
  });

  test('Colaborador es rechazado', async () => {
    const { req, res, next } = mockReqRes({ role: 'COLLABORATOR', companyId: 'c1', userId: 'u1' });
    await requireAccessManagement(req, res, next);
    expect(next.mock.calls[0][0]).toBeDefined();
  });

  test('sin sesión iniciada es rechazado', async () => {
    const { req, res, next } = mockReqRes(undefined);
    await requireAccessManagement(req, res, next);
    expect(next.mock.calls[0][0].message).toBe('Debes iniciar sesión para hacer esto.');
  });
});
