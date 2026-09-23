// Mi Cuenta, punto 12: "solicitar baja de cuenta". Nunca borra nada
// directamente — crea una solicitud que debe aprobar un Administrador.
// Al aprobarla, desactiva al usuario con el mismo efecto que ya tiene
// access-levels.deactivateUser (isActive/status), pero sin llamar a
// ese servicio directamente: vive en modules/access-levels y core no
// puede depender de modules/ (regla de arquitectura) — es la misma
// razón por la que acceptInvitation vive en core/auth y no ahí.
const prisma = require('../../database/prisma');
const AppError = require('../../utils/AppError');
const auditService = require('../../audit/audit.service');

async function requestDeletion(companyId, userId, reason) {
  const existing = await prisma.accountDeletionRequest.findFirst({ where: { userId, status: 'PENDING' } });
  if (existing) {
    throw new AppError('Ya tienes una solicitud de baja pendiente de revisión.', 400, 'DELETION_ALREADY_PENDING');
  }

  const request = await prisma.accountDeletionRequest.create({
    data: { companyId, userId, reason: reason || null },
  });

  await auditService.log({
    companyId,
    userId,
    action: 'account_deletion.requested',
    entityType: 'AccountDeletionRequest',
    entityId: request.id,
    oldValue: null,
    newValue: { reason: reason || null },
  });

  return request;
}

async function listDeletionRequests(companyId, { status } = {}) {
  return prisma.accountDeletionRequest.findMany({
    where: { companyId, status: status || undefined },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { requestedAt: 'desc' },
  });
}

async function decideDeletion(companyId, decidedByUserId, requestId, { approve, note }) {
  const request = await prisma.accountDeletionRequest.findFirst({ where: { id: requestId, companyId } });
  if (!request) throw new AppError('La solicitud indicada no existe.', 404, 'DELETION_REQUEST_NOT_FOUND');
  if (request.status !== 'PENDING') {
    throw new AppError('Esta solicitud ya fue resuelta.', 400, 'DELETION_ALREADY_DECIDED');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.accountDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        decidedByUserId,
        decidedAt: new Date(),
        decisionNote: note || null,
      },
    });

    if (approve) {
      await tx.user.update({ where: { id: request.userId }, data: { isActive: false, status: 'INACTIVE' } });
    }

    await auditService.log(
      {
        companyId,
        userId: decidedByUserId,
        action: approve ? 'account_deletion.approved' : 'account_deletion.rejected',
        entityType: 'AccountDeletionRequest',
        entityId: requestId,
        oldValue: { status: 'PENDING' },
        newValue: { status: updated.status, decisionNote: note || null },
      },
      tx
    );

    return updated;
  });
}

module.exports = { requestDeletion, listDeletionRequests, decideDeletion };
