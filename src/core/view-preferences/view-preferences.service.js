// Última vista elegida (Lista/Kanban/Calendario) por una pantalla con
// selector de vista, guardada por usuario y por `viewKey` — mismo
// patrón que core/panel-preferences.
const prisma = require('../database/prisma');

async function getPreference(userId, viewKey) {
  const pref = await prisma.viewModePreference.findUnique({ where: { userId_viewKey: { userId, viewKey } } });
  return { viewKey, mode: pref?.mode ?? 'LIST' };
}

async function setPreference(companyId, userId, viewKey, mode) {
  const pref = await prisma.viewModePreference.upsert({
    where: { userId_viewKey: { userId, viewKey } },
    update: { mode },
    create: { companyId, userId, viewKey, mode },
  });
  return { viewKey: pref.viewKey, mode: pref.mode };
}

module.exports = { getPreference, setPreference };
