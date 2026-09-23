const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function getSettings(companyId) {
  const settings = await prisma.accountingSettings.findUnique({ where: { companyId } });
  if (!settings) {
    throw new AppError('Esta empresa todavía no tiene configuración de Contabilidad.', 404, 'SETTINGS_NOT_FOUND');
  }
  return settings;
}

async function updateSettings(companyId, userId, changes) {
  const settings = await getSettings(companyId);

  if (changes.fxGainLossAccountId) {
    const account = await prisma.account.findFirst({ where: { id: changes.fxGainLossAccountId, companyId } });
    if (!account) {
      throw new AppError('La cuenta de diferencial cambiario indicada no existe en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.accountingSettings.update({ where: { companyId }, data: changes });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'accounting_settings.updated',
        entityType: 'AccountingSettings',
        entityId: settings.id,
        oldValue: settings,
        newValue: updated,
      },
      tx
    );
    return updated;
  });
}

module.exports = { getSettings, updateSettings };
