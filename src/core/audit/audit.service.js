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
//
// Fase 11 (sección 14, "Audit filters"): ganó `action` (para investigar
// una operación concreta, ej. "Empresa A, 01/09→30/09, módulo
// Finanzas, acción APPROVED") y `limit` (sección 27, performance — la
// bitácora de una empresa puede crecer sin límite; nunca se devuelve
// sin tope, aunque no se pidan filtros).
async function listForCompany(companyId, { entityType, action, from, to, userId, limit = 200 } = {}) {
  return prisma.auditLog.findMany({
    where: {
      companyId,
      entityType: entityType || undefined,
      action: action || undefined,
      userId: userId || undefined,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 1000),
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

// Fase Afiliados: única lectura de AuditLog que NO filtra por
// companyId — reservada a entidades que genuinamente viven fuera de
// cualquier empresa (ver companyId? nullable en el modelo), usada solo
// por la administración cruzada de afiliados (nunca expuesta a una
// empresa cliente, que sigue viendo exclusivamente su propia bitácora
// vía listForCompany/listForEntity de siempre).
async function listForEntityTypesAnyCompany(entityTypes) {
  return prisma.auditLog.findMany({
    where: { entityType: { in: entityTypes } },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
    take: 500,
  });
}

module.exports = { log, listForEntity, listForEntities, listForCompany, listForEntityTypesAnyCompany };
