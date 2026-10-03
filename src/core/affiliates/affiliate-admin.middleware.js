const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Puerta de la administración CRUZADA de afiliados/comisiones — a
// diferencia de todo el resto del RBAC del proyecto (core/rbac), que
// vive puramente por-empresa, esto no tiene nada que ver con el rol
// del usuario dentro de SU empresa (un ADMIN de una empresa cliente no
// entra acá solo por serlo). Se monta DESPUÉS de requireAuth normal
// (reutiliza la sesión de Company ya existente, no inventa una
// tercera forma de loguearse) y revisa el flag explícito
// User.isAffiliateProgramAdmin, leído fresco de la base en cada
// petición (nunca guardado en el JWT) para que revocarlo a mano surta
// efecto de inmediato, mismo criterio que ya usa requireAccessManagement
// con el permiso delegado de Niveles de Acceso.
async function requireAffiliateProgramAdmin(req, res, next) {
  if (!req.auth) {
    throw new AppError('Debes iniciar sesión para hacer esto.', 401, 'NOT_AUTHENTICATED');
  }
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId }, select: { isAffiliateProgramAdmin: true } });
  if (!user || !user.isAffiliateProgramAdmin) {
    throw new AppError('No tienes acceso a la administración de afiliados.', 403, 'FORBIDDEN');
  }
  next();
}

module.exports = { requireAffiliateProgramAdmin: asyncHandler(requireAffiliateProgramAdmin) };
