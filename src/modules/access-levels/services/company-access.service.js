// F14-E3: única pieza de "pertenencia/acceso de usuarios a empresas"
// que el mapa de ownership de F14-E2 encontró como gap real dentro del
// alcance permitido de esta etapa — UserCompanyAccess ya existía y ya
// se validaba correctamente (switchActiveCompany, core/account), pero
// ningún endpoint podía escribirla. Deliberadamente acotado a
// ADMIN-otorga-a-ADMIN: evita tener que resolver cupos por rol
// cruzando empresas (ADMIN no tiene cupo en core/rbac/roles.js), sin
// inventar un motor de permisos nuevo.
//
// Otorgar esta fila NUNCA da lectura/escritura de ningún dato de
// negocio por sí sola — solo permite que switchActiveCompany acepte
// esa empresa como destino; para ver algo, el usuario debe cambiar
// activamente su empresa activa y obtener un JWT nuevo, y desde ahí
// aplican las mismas reglas de siempre (RBAC + companyId por fila).
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function findGrantableAdmin(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('No existe ningún usuario con ese correo.', 404, 'USER_NOT_FOUND');
  }
  if (user.role !== 'ADMIN') {
    throw new AppError(
      'Solo se puede otorgar acceso entre empresas a un usuario que ya sea Administrador.',
      403,
      'TARGET_MUST_BE_ADMIN'
    );
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('Ese usuario todavía no está activo.', 400, 'TARGET_NOT_ACTIVE');
  }
  return user;
}

async function grantCompanyAccess(companyId, actingUserId, email) {
  const target = await findGrantableAdmin(email);

  if (target.companyId === companyId) {
    throw new AppError('Ese usuario ya pertenece a esta empresa.', 400, 'ALREADY_HOME_COMPANY');
  }

  const existing = await prisma.userCompanyAccess.findUnique({
    where: { userId_companyId: { userId: target.id, companyId } },
  });
  if (existing) {
    throw new AppError('Ese usuario ya tiene acceso otorgado a esta empresa.', 409, 'ACCESS_ALREADY_GRANTED');
  }

  return prisma.$transaction(async (tx) => {
    const access = await tx.userCompanyAccess.create({
      data: { userId: target.id, companyId, isDefault: false },
    });
    await auditService.log(
      {
        companyId,
        userId: actingUserId,
        action: 'company_access.granted',
        entityType: 'UserCompanyAccess',
        entityId: access.id,
        oldValue: null,
        newValue: { grantedToUserId: target.id, grantedToEmail: target.email },
      },
      tx
    );
    return access;
  });
}

async function revokeCompanyAccess(companyId, actingUserId, email) {
  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) {
    throw new AppError('No existe ningún usuario con ese correo.', 404, 'USER_NOT_FOUND');
  }

  if (target.companyId === companyId) {
    throw new AppError('No puedes revocar el acceso de un usuario a su propia empresa de origen.', 400, 'CANNOT_REVOKE_HOME_ACCESS');
  }

  const access = await prisma.userCompanyAccess.findUnique({
    where: { userId_companyId: { userId: target.id, companyId } },
  });
  if (!access) {
    throw new AppError('Ese usuario no tiene ningún acceso otorgado a esta empresa.', 404, 'ACCESS_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    await tx.userCompanyAccess.delete({ where: { id: access.id } });
    await auditService.log(
      {
        companyId,
        userId: actingUserId,
        action: 'company_access.revoked',
        entityType: 'UserCompanyAccess',
        entityId: access.id,
        oldValue: { grantedToUserId: target.id, grantedToEmail: target.email },
        newValue: null,
      },
      tx
    );
    return { revoked: true };
  });
}

async function listGrantedAccess(companyId) {
  const rows = await prisma.userCompanyAccess.findMany({
    where: { companyId, isDefault: false },
    select: { id: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return rows;
}

module.exports = { grantCompanyAccess, revokeCompanyAccess, listGrantedAccess };
