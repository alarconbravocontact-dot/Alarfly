// Autocompletado con búsqueda difusa (frontend/src/core/ui/EntityAutocomplete.jsx):
// este servicio solo guarda un ranking de "qué eligió este usuario en
// este campo, y cuándo" — la búsqueda difusa en sí corre en el
// navegador sobre la lista que cada pantalla ya carga, mismo criterio
// que el constructor de filtros (core/saved-views) y las preferencias
// de columnas (core/table-preferences): nunca se construyó un motor de
// búsqueda nuevo en el backend para esto.
const prisma = require('../database/prisma');

async function recordUsage(companyId, userId, entityType, entityId) {
  await prisma.recentlyUsedEntity.upsert({
    where: { userId_entityType_entityId: { userId, entityType, entityId } },
    update: { lastUsedAt: new Date(), useCount: { increment: 1 } },
    create: { companyId, userId, entityType, entityId },
  });
}

async function listRecent(userId, entityType, limit = 10) {
  const rows = await prisma.recentlyUsedEntity.findMany({
    where: { userId, entityType },
    orderBy: { lastUsedAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => r.entityId);
}

module.exports = { recordUsage, listRecent };
