// Constructor de filtros acumulativos (visual): este servicio solo
// guarda/lee la DEFINICIÓN del filtro (nombre + árbol de condiciones),
// nunca los datos filtrados en sí — el filtrado ocurre en el navegador,
// sobre los datos que cada pantalla ya carga (ver
// frontend/src/utils/conditionEvaluator.js).
const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');

const includeCreator = { createdByUser: { select: { id: true, name: true } } };

async function listSavedViews(companyId, tableKey) {
  return prisma.savedView.findMany({
    where: { companyId, tableKey },
    include: includeCreator,
    orderBy: { createdAt: 'desc' },
  });
}

async function createSavedView(companyId, userId, { tableKey, name, conditionTree }) {
  return prisma.savedView.create({
    data: { companyId, createdByUserId: userId, tableKey, name, conditionTree },
    include: includeCreator,
  });
}

async function getSavedView(companyId, id) {
  const view = await prisma.savedView.findFirst({ where: { id, companyId }, include: includeCreator });
  if (!view) throw new AppError('La vista guardada no existe o no pertenece a tu empresa.', 404, 'SAVED_VIEW_NOT_FOUND');
  return view;
}

// Compartir un enlace no requiere ningún cambio acá: cualquiera en la
// misma empresa que llegue a este endpoint ya pasó por requireAuth, y
// el where ya filtra por companyId — no hace falta una lista de
// destinatarios ni un permiso nuevo.
async function deleteSavedView(companyId, userId, userRole, id) {
  const view = await prisma.savedView.findFirst({ where: { id, companyId } });
  if (!view) throw new AppError('La vista guardada no existe o no pertenece a tu empresa.', 404, 'SAVED_VIEW_NOT_FOUND');
  if (view.createdByUserId !== userId && userRole !== 'ADMIN') {
    throw new AppError('Solo quien la creó o un Administrador puede eliminar esta vista.', 403, 'FORBIDDEN');
  }
  await prisma.savedView.delete({ where: { id } });
}

module.exports = { listSavedViews, createSavedView, getSavedView, deleteSavedView };
