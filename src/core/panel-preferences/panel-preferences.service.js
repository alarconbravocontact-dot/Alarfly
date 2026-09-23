// Estado de "contraído/expandido" de cualquier panel colapsable de la
// app (ej. las tarjetas de resumen ejecutivo de un módulo) — guardado
// por usuario y por `panelKey`, nunca compartido entre usuarios, mismo
// criterio que core/table-preferences.
const prisma = require('../database/prisma');

async function getPreference(userId, panelKey) {
  const pref = await prisma.panelCollapsePreference.findUnique({ where: { userId_panelKey: { userId, panelKey } } });
  return { panelKey, isCollapsed: pref?.isCollapsed ?? false };
}

async function setPreference(companyId, userId, panelKey, isCollapsed) {
  const pref = await prisma.panelCollapsePreference.upsert({
    where: { userId_panelKey: { userId, panelKey } },
    update: { isCollapsed },
    create: { companyId, userId, panelKey, isCollapsed },
  });
  return { panelKey: pref.panelKey, isCollapsed: pref.isCollapsed };
}

module.exports = { getPreference, setPreference };
