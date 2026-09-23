const prisma = require('../database/prisma');

// Registra una acción sensible. Se llama desde dentro de las mismas
// transacciones que hacen el cambio real, para que quede constancia
// aunque falle cualquier otra cosa después.
// tx: opcional, cliente de Prisma dentro de una transacción en curso.
async function log({ companyId, userId, action, entityType, entityId, oldValue, newValue }, tx = prisma) {
  return tx.auditLog.create({
    data: { companyId, userId, action, entityType, entityId, oldValue, newValue },
  });
}

async function listForEntity(companyId, entityType, entityId) {
  return prisma.auditLog.findMany({
    where: { companyId, entityType, entityId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

// Igual que listForEntity, pero para varias entidades de distinto tipo
// a la vez (ej. una factura + los cobros y notas de crédito que la
// tocaron) — usado por la línea de tiempo de un documento, que nunca
// inventa eventos: siempre lee las filas reales de AuditLog de todo lo
// que participó en su ciclo de vida. `refs` es [{entityType, entityId}].
async function listForEntities(companyId, refs) {
  if (!Array.isArray(refs) || refs.length === 0) return [];
  return prisma.auditLog.findMany({
    where: { companyId, OR: refs.map(({ entityType, entityId }) => ({ entityType, entityId })) },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

// userId: opcional — lo usa Mi Cuenta (core/account/services/activity.service.js)
// para el historial de actividad PERSONAL de un usuario, sin duplicar
// esta consulta en otro archivo.
async function listForCompany(companyId, { entityType, from, to, userId } = {}) {
  return prisma.auditLog.findMany({
    where: {
      companyId,
      entityType: entityType || undefined,
      userId: userId || undefined,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

module.exports = { log, listForEntity, listForEntities, listForCompany };
