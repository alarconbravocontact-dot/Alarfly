// Mi Cuenta, punto 5: a qué empresas tiene acceso el usuario y cuál
// tiene activa ahora mismo. Hoy cada usuario nace con exactamente un
// acceso (su empresa original) — no existe todavía ningún flujo que le
// otorgue una segunda empresa; el selector queda listo para cuando
// exista ese flujo, sin inventarlo acá.
const prisma = require('../../database/prisma');
const AppError = require('../../utils/AppError');
const authService = require('../../auth/auth.service');

async function listMyCompanies(userId) {
  return prisma.userCompanyAccess.findMany({
    where: { userId },
    select: { companyId: true, isDefault: true, company: { select: { id: true, name: true } } },
    orderBy: { isDefault: 'desc' },
  });
}

// Reemite el token con la empresa elegida, sin crear una sesión nueva
// (misma sesión, otra empresa activa). El rol del usuario es el mismo
// en cualquier empresa a la que tenga acceso — este modelo de datos no
// tiene un rol distinto por empresa (User.role es un solo valor).
async function switchActiveCompany(userId, sessionId, companyId) {
  const access = await prisma.userCompanyAccess.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!access) {
    throw new AppError('No tienes acceso a esa empresa.', 403, 'COMPANY_ACCESS_DENIED');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return authService.buildSession(user, sessionId, companyId);
}

module.exports = { listMyCompanies, switchActiveCompany };
