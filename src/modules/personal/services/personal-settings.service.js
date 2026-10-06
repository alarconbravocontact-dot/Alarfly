// Configuración del módulo: a qué cuenta contable va cada obligación
// por defecto. Vive DENTRO de `modules/personal` (no en /core) porque,
// a diferencia de ArApSettings (compartida entre dos módulos
// distintos, AR y AP), esto lo usan dos SUB-áreas del mismo módulo
// (Nómina y Gastos) — mismo criterio que InventorySettings/
// TreasurySettings, que tampoco viven en /core.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function getOrCreateSettings(companyId) {
  let settings = await prisma.personalSettings.findUnique({ where: { companyId } });
  if (!settings) {
    settings = await prisma.personalSettings.create({ data: { companyId } });
  }
  return settings;
}

const ACCOUNT_FIELDS = ['payrollExpenseAccountId', 'payrollPayableAccountId', 'expenseAccountId', 'expenseReimbursementPayableAccountId'];

async function updateSettings(companyId, userId, changes) {
  const settings = await getOrCreateSettings(companyId);

  for (const field of ACCOUNT_FIELDS) {
    if (changes[field]) {
      const account = await prisma.account.findFirst({ where: { id: changes[field], companyId } });
      if (!account) {
        throw new AppError('Una de las cuentas contables indicadas no existe en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.personalSettings.update({ where: { companyId }, data: changes });
    await auditService.log(
      { companyId, userId, action: 'personal_settings.updated', entityType: 'PersonalSettings', entityId: settings.id, oldValue: settings, newValue: updated },
      tx
    );
    return updated;
  });
}

async function assertPayrollAccountsConfigured(companyId) {
  const settings = await getOrCreateSettings(companyId);
  if (!settings.payrollExpenseAccountId || !settings.payrollPayableAccountId) {
    throw new AppError(
      'Todavía no se configuraron las cuentas contables de Nómina. Configúralas en Personal > Ajustes antes de aprobar una nómina.',
      400,
      'PAYROLL_ACCOUNTS_NOT_CONFIGURED'
    );
  }
  return { expenseAccountId: settings.payrollExpenseAccountId, payableAccountId: settings.payrollPayableAccountId };
}

async function assertExpenseAccountsConfigured(companyId) {
  const settings = await getOrCreateSettings(companyId);
  if (!settings.expenseAccountId || !settings.expenseReimbursementPayableAccountId) {
    throw new AppError(
      'Todavía no se configuraron las cuentas contables de Gastos de Personal. Configúralas en Personal > Ajustes antes de aprobar un gasto.',
      400,
      'EXPENSE_ACCOUNTS_NOT_CONFIGURED'
    );
  }
  return { expenseAccountId: settings.expenseAccountId, payableAccountId: settings.expenseReimbursementPayableAccountId };
}

module.exports = {
  getOrCreateSettings,
  updateSettings,
  assertPayrollAccountsConfigured,
  assertExpenseAccountsConfigured,
};
