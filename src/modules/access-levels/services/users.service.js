// Niveles de Acceso: gestión de usuarios de la empresa (roles, cupos,
// invitaciones, activar/desactivar). Reutiliza core/rbac para las
// reglas de cupo y core/audit para dejar constancia de cada cambio —
// no duplica ninguna de las dos cosas.
const crypto = require('crypto');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { ROLES, ROLE_QUOTAS } = require('../../../core/rbac/roles');
const { assertQuotaAvailable } = require('../../../core/rbac/rbac.rules');

const INVITATION_EXPIRY_DAYS = 7;

async function listUsers(companyId) {
  return prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isActive: true,
      createdAt: true,
      invitedByUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

// Cuántos usuarios ACTIVOS tiene cada rol hoy, contra su cupo máximo —
// lo que el frontend usa para mostrar "Colaboradores: 5/8 usados" y
// deshabilitar un rol en el selector antes de intentar guardar.
async function getRoleQuotaStatus(companyId) {
  const counts = await prisma.user.groupBy({
    by: ['role'],
    where: { companyId, status: 'ACTIVE' },
    _count: true,
  });
  const countByRole = Object.fromEntries(counts.map((c) => [c.role, c._count]));

  return ROLES.map((role) => ({
    role,
    used: countByRole[role] || 0,
    quota: ROLE_QUOTAS[role],
    isFull: ROLE_QUOTAS[role] != null && (countByRole[role] || 0) >= ROLE_QUOTAS[role],
  }));
}

async function countActiveByRole(companyId, role, excludeUserId) {
  return prisma.user.count({
    where: { companyId, role, status: 'ACTIVE', id: excludeUserId ? { not: excludeUserId } : undefined },
  });
}

async function inviteUser(companyId, invitedByUserId, { email, name, role }) {
  if (!ROLES.includes(role)) {
    throw new AppError('El rol indicado no existe.', 400, 'INVALID_ROLE');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('Ya existe un usuario con ese correo.', 409, 'EMAIL_ALREADY_EXISTS');
  }

  const activeCount = await countActiveByRole(companyId, role);
  assertQuotaAvailable(role, activeCount);

  const invitationToken = crypto.randomBytes(32).toString('hex');
  const invitationExpiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      companyId,
      name,
      email,
      role,
      status: 'INVITED',
      isActive: false,
      passwordHash: null,
      invitedByUserId,
      invitationToken,
      invitationExpiresAt,
    },
  });

  await auditService.log({
    companyId,
    userId: invitedByUserId,
    action: 'user.invited',
    entityType: 'User',
    entityId: user.id,
    oldValue: null,
    newValue: { email, role },
  });

  // Adapter de email: por ahora solo MOCK — genera el enlace/token de
  // invitación y lo devuelve, no manda ningún correo real todavía.
  // Punto de extensión listo, mismo criterio que core/alerts.notifyAlert().
  return { user, invitationToken, invitationExpiresAt };
}

async function changeRole(companyId, actingUserId, targetUserId, newRole) {
  if (!ROLES.includes(newRole)) {
    throw new AppError('El rol indicado no existe.', 400, 'INVALID_ROLE');
  }

  const target = await prisma.user.findFirst({ where: { id: targetUserId, companyId } });
  if (!target) {
    throw new AppError('El usuario indicado no existe.', 404, 'USER_NOT_FOUND');
  }

  if (target.role === newRole) {
    return target;
  }

  if (target.status === 'ACTIVE') {
    const activeCount = await countActiveByRole(companyId, newRole, target.id);
    assertQuotaAvailable(newRole, activeCount);
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data: { role: newRole } });

  await auditService.log({
    companyId,
    userId: actingUserId,
    action: 'user.role_changed',
    entityType: 'User',
    entityId: target.id,
    oldValue: { role: target.role },
    newValue: { role: newRole },
  });

  return updated;
}

async function deactivateUser(companyId, actingUserId, targetUserId) {
  if (actingUserId === targetUserId) {
    throw new AppError('No puedes desactivar tu propio usuario.', 400, 'CANNOT_DEACTIVATE_SELF');
  }

  const target = await prisma.user.findFirst({ where: { id: targetUserId, companyId } });
  if (!target) {
    throw new AppError('El usuario indicado no existe.', 404, 'USER_NOT_FOUND');
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { isActive: false, status: 'INACTIVE' },
  });

  await auditService.log({
    companyId,
    userId: actingUserId,
    action: 'user.deactivated',
    entityType: 'User',
    entityId: target.id,
    oldValue: { status: target.status },
    newValue: { status: 'INACTIVE' },
  });

  return updated;
}

async function activateUser(companyId, actingUserId, targetUserId) {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, companyId } });
  if (!target) {
    throw new AppError('El usuario indicado no existe.', 404, 'USER_NOT_FOUND');
  }
  if (target.status === 'INVITED') {
    throw new AppError('Este usuario todavía no aceptó su invitación.', 400, 'USER_STILL_INVITED');
  }

  const activeCount = await countActiveByRole(companyId, target.role, target.id);
  assertQuotaAvailable(target.role, activeCount);

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { isActive: true, status: 'ACTIVE' },
  });

  await auditService.log({
    companyId,
    userId: actingUserId,
    action: 'user.activated',
    entityType: 'User',
    entityId: target.id,
    oldValue: { status: target.status },
    newValue: { status: 'ACTIVE' },
  });

  return updated;
}

module.exports = {
  listUsers,
  getRoleQuotaStatus,
  countActiveByRole,
  inviteUser,
  changeRole,
  deactivateUser,
  activateUser,
};
