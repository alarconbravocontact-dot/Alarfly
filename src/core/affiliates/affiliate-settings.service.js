const prisma = require('../database/prisma');

// Fila única de configuración de comisión para toda la plataforma (no
// hay "empresa" a la cual colgarla — ver schema.prisma). `getSettings`
// la crea con los valores por defecto la primera vez que alguien la
// necesita (ej. el primer signup con referido), para no depender de
// un seed manual antes de que el programa pueda funcionar.
async function getSettings(tx = prisma) {
  const existing = await tx.affiliateProgramSettings.findFirst();
  if (existing) return existing;
  return tx.affiliateProgramSettings.create({ data: {} });
}

async function updateSettings({ rateType, rateValue, referenceAmount, currency }) {
  const settings = await getSettings();
  return prisma.affiliateProgramSettings.update({
    where: { id: settings.id },
    data: {
      rateType: rateType ?? undefined,
      rateValue: rateValue ?? undefined,
      referenceAmount: referenceAmount ?? undefined,
      currency: currency ?? undefined,
    },
  });
}

module.exports = { getSettings, updateSettings };
