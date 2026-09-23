// Permisos delegados: excepciones puntuales que el Administrador le
// otorga a un usuario concreto sin cambiarle el rol (hoy solo existe
// uno: acceso al módulo Niveles de Acceso para un ACCOUNTANT). No
// duplica el chequeo de rol — es una capa aparte que se consulta
// además del rol cuando el rol solo no alcanza.
const prisma = require('../database/prisma');
const auditService = require('../audit/audit.service');

async function hasActivePermission(companyId, userId, permissionKey) {
  const grant = await prisma.delegatedPermission.findUnique({
    where: { userId_permissionKey: { userId, permissionKey } },
  });
  return Boolean(grant && grant.isActive);
}

async function listForCompany(companyId) {
  return prisma.delegatedPermission.findMany({ where: { companyId }, include: { user: true } });
}

// Los permisos delegados ACTIVOS del propio usuario que llama — a
// diferencia de listForCompany, esto no exige estar ya dentro de
// Niveles de Acceso (sería una trampa circular: un Contador necesita
// consultar si tiene el permiso justo para saber si puede entrar).
async function listActiveForUser(userId) {
  const grants = await prisma.delegatedPermission.findMany({ where: { userId, isActive: true } });
  return grants.map((g) => g.permissionKey);
}

async function grantPermission(companyId, grantedByUserId, userId, permissionKey) {
  const grant = await prisma.delegatedPermission.upsert({
    where: { userId_permissionKey: { userId, permissionKey } },
    update: { isActive: true, grantedByUserId },
    create: { companyId, userId, permissionKey, grantedByUserId },
  });

  await auditService.log({
    companyId,
    userId: grantedByUserId,
    action: 'delegated_permission.granted',
    entityType: 'DelegatedPermission',
    entityId: grant.id,
    oldValue: null,
    newValue: { userId, permissionKey },
  });

  return grant;
}

async function revokePermission(companyId, revokedByUserId, userId, permissionKey) {
  const grant = await prisma.delegatedPermission.update({
    where: { userId_permissionKey: { userId, permissionKey } },
    data: { isActive: false },
  });

  await auditService.log({
    companyId,
    userId: revokedByUserId,
    action: 'delegated_permission.revoked',
    entityType: 'DelegatedPermission',
    entityId: grant.id,
    oldValue: { userId, permissionKey, isActive: true },
    newValue: { isActive: false },
  });

  return grant;
}

module.exports = { hasActivePermission, listForCompany, listActiveForUser, grantPermission, revokePermission };
