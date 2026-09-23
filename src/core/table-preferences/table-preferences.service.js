// Componente de tabla reutilizable (frontend/src/core/ui/DataTable.jsx):
// este servicio solo guarda/lee CÓMO se ve una tabla para un usuario
// (orden, ancho y visibilidad de columnas) — nunca los datos de la
// tabla en sí, y nunca compartido con otros usuarios (a diferencia de
// SavedView, que sí se comparte con un enlace).
const prisma = require('../database/prisma');

async function getPreferences(userId, tableKey) {
  return prisma.tableColumnPreference.findMany({
    where: { userId, tableKey },
    orderBy: { order: 'asc' },
  });
}

// Reemplaza toda la configuración de columnas de esa tabla para ese
// usuario de una sola vez (el frontend siempre manda la lista completa,
// nunca un cambio parcial) — más simple que reconciliar fila por fila,
// y el volumen es chico (unas pocas columnas por tabla).
async function savePreferences(companyId, userId, tableKey, columns) {
  return prisma.$transaction(async (tx) => {
    await tx.tableColumnPreference.deleteMany({ where: { userId, tableKey } });
    if (columns.length > 0) {
      await tx.tableColumnPreference.createMany({
        data: columns.map((c) => ({
          companyId,
          userId,
          tableKey,
          columnKey: c.columnKey,
          isVisible: c.isVisible,
          width: c.width ?? null,
          order: c.order,
        })),
      });
    }
    return tx.tableColumnPreference.findMany({ where: { userId, tableKey }, orderBy: { order: 'asc' } });
  });
}

// "Restablecer vista por defecto": borra lo guardado, el frontend
// vuelve a armar el estado con las columnas por defecto que ya conoce.
async function resetPreferences(userId, tableKey) {
  await prisma.tableColumnPreference.deleteMany({ where: { userId, tableKey } });
}

module.exports = { getPreferences, savePreferences, resetPreferences };
