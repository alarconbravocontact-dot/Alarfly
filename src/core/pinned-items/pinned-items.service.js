// Reportes y vistas filtradas anclados al menú lateral. Genérico a
// propósito: ancla cualquier `path` real de navegación (incluye el
// query string cuando ancla una vista filtrada), sin saber nada de
// reportes ni de facturas — la pantalla que ofrece el botón de anclar
// decide qué ruta y qué etiqueta mandar.
const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const { rankPinnedItems } = require('./pinned-items.rules');

async function listPinnedItems(companyId, userId) {
  const items = await prisma.pinnedItem.findMany({ where: { companyId, userId } });
  return rankPinnedItems(items, new Date());
}

async function pinItem(companyId, userId, { path, label }) {
  return prisma.pinnedItem.upsert({
    where: { userId_path: { userId, path } },
    update: { label },
    create: { companyId, userId, path, label },
  });
}

async function unpinItem(companyId, userId, id) {
  const item = await prisma.pinnedItem.findFirst({ where: { id, companyId, userId } });
  if (!item) {
    throw new AppError('El ítem anclado indicado no existe.', 404, 'PINNED_ITEM_NOT_FOUND');
  }
  await prisma.pinnedItem.delete({ where: { id } });
}

// Se llama en cada navegación real de la SPA (no en cada render) para
// que la frecuencia refleje uso genuino — no falla ni avisa nada si la
// ruta visitada no está anclada, es la mayoría de las navegaciones.
async function recordVisit(companyId, userId, path) {
  const item = await prisma.pinnedItem.findUnique({ where: { userId_path: { userId, path } } });
  if (!item || item.companyId !== companyId) return null;
  return prisma.pinnedItem.update({
    where: { id: item.id },
    data: { visitCount: { increment: 1 }, lastVisitedAt: new Date() },
  });
}

module.exports = { listPinnedItems, pinItem, unpinItem, recordVisit };
