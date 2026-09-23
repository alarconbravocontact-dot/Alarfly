const AppError = require('../utils/AppError');
const { rolesForModule } = require('./module-access');
const { DELEGATABLE_PERMISSIONS } = require('./roles');
const delegatedPermissionsService = require('./delegated-permissions.service');
const asyncHandler = require('../utils/asyncHandler');

// Primera puerta de cada módulo de negocio: ¿el rol de este usuario
// tiene permiso base para entrar acá? Las rutas de escritura dentro
// del módulo siguen filtrando más fino con `requireRole(...)` del
// core/auth existente — este middleware no lo reemplaza, se monta antes.
function requireModuleAccess(moduleKey) {
  const allowedRoles = rolesForModule(moduleKey);
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      throw new AppError('No tienes acceso a este módulo con tu rol actual.', 403, 'MODULE_ACCESS_DENIED');
    }
    next();
  };
}

// Puerta del módulo Niveles de Acceso: ADMIN siempre entra. Un
// ACCOUNTANT entra solo si el Administrador le otorgó el permiso
// delegado ACCESS_LEVELS explícitamente — no cambia su rol base, es
// una excepción puntual (ver core/rbac/delegated-permissions.service.js).
async function requireAccessManagement(req, res, next) {
  if (!req.auth) {
    throw new AppError('Debes iniciar sesión para hacer esto.', 401, 'NOT_AUTHENTICATED');
  }
  if (req.auth.role === 'ADMIN') {
    return next();
  }
  if (req.auth.role === 'ACCOUNTANT') {
    const hasDelegated = await delegatedPermissionsService.hasActivePermission(
      req.auth.companyId,
      req.auth.userId,
      DELEGATABLE_PERMISSIONS.ACCESS_LEVELS
    );
    if (hasDelegated) return next();
  }
  throw new AppError('Solo el Administrador puede entrar a Niveles de Acceso.', 403, 'FORBIDDEN');
}

// Envuelto con asyncHandler: al ser middleware async (no un controlador
// final), un throw directo se convierte en una promesa rechazada que
// Express 4 no atrapa — quedaría como una excepción no manejada y
// tumbaría el proceso entero en vez de responder 403. asyncHandler la
// entrega a next(err), como ya hace todo controlador async del proyecto.
module.exports = { requireModuleAccess, requireAccessManagement: asyncHandler(requireAccessManagement) };
