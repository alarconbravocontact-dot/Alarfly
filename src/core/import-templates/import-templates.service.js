// Asistente de importación: este servicio solo guarda/lee el MAPEO de
// columnas elegido (qué encabezado del archivo corresponde a qué campo
// del sistema), nunca los datos importados en sí — mismo principio que
// core/saved-views. Compartido a nivel empresa (no por usuario): un
// mapeo de columnas es útil para todo el equipo que importe el mismo
// tipo de archivo, no solo para quien lo creó la primera vez.
const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');

const includeCreator = { createdByUser: { select: { id: true, name: true } } };

async function listTemplates(companyId, targetKey) {
  return prisma.importTemplate.findMany({
    where: { companyId, targetKey },
    include: includeCreator,
    orderBy: { createdAt: 'desc' },
  });
}

async function createTemplate(companyId, userId, { targetKey, name, columnMapping }) {
  return prisma.importTemplate.create({
    data: { companyId, createdByUserId: userId, targetKey, name, columnMapping },
    include: includeCreator,
  });
}

async function deleteTemplate(companyId, userId, userRole, id) {
  const template = await prisma.importTemplate.findFirst({ where: { id, companyId } });
  if (!template) {
    throw new AppError('La plantilla de importación no existe o no pertenece a tu empresa.', 404, 'IMPORT_TEMPLATE_NOT_FOUND');
  }
  if (template.createdByUserId !== userId && userRole !== 'ADMIN') {
    throw new AppError('Solo quien la creó o un Administrador puede eliminar esta plantilla.', 403, 'FORBIDDEN');
  }
  await prisma.importTemplate.delete({ where: { id } });
}

module.exports = { listTemplates, createTemplate, deleteTemplate };
