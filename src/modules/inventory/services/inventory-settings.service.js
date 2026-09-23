// Configuración de Inventario por empresa (mismo patrón que
// AccountingSettings/TreasurySettings/FpaSettings/ArApSettings).
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function getOrCreateSettings(companyId) {
  let settings = await prisma.inventorySettings.findUnique({ where: { companyId } });
  if (!settings) {
    settings = await prisma.inventorySettings.create({ data: { companyId } });
  }
  return settings;
}

async function updateSettings(companyId, userId, changes) {
  const settings = await getOrCreateSettings(companyId);

  for (const field of ['defaultInventoryAssetAccountId', 'defaultCogsExpenseAccountId', 'defaultShrinkageExpenseAccountId']) {
    if (changes[field]) {
      const account = await prisma.account.findFirst({ where: { id: changes[field], companyId } });
      if (!account) {
        throw new AppError('Una de las cuentas contables indicadas no existe en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.inventorySettings.update({ where: { companyId }, data: changes });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'inventory_settings.updated',
        entityType: 'InventorySettings',
        entityId: settings.id,
        oldValue: settings,
        newValue: updated,
      },
      tx
    );
    return updated;
  });
}

module.exports = { getOrCreateSettings, updateSettings };
