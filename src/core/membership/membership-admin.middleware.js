const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Puerta de la administración CRUZADA de pagos de membresía — igual
// criterio que `requireAffiliateProgramAdmin` (core/affiliates): no
// tiene nada que ver con el rol del usuario dentro de SU empresa. Se
// monta después de requireAuth normal y revisa el flag explícito
// User.isMembershipAdmin, leído fresco de la base en cada petición.
async function requireMembershipAdmin(req, res, next) {
  if (!req.auth) {
    throw new AppError('Debes iniciar sesión para hacer esto.', 401, 'NOT_AUTHENTICATED');
  }
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId }, select: { isMembershipAdmin: true } });
  if (!user || !user.isMembershipAdmin) {
    throw new AppError('No tienes acceso a la administración de membresías.', 403, 'FORBIDDEN');
  }
  next();
}

module.exports = { requireMembershipAdmin: asyncHandler(requireMembershipAdmin) };
