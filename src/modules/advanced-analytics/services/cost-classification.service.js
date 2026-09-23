const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

async function listClassifications(companyId) {
  return prisma.analysisCostClassification.findMany({
    where: { companyId },
    include: { account: { select: { code: true, name: true } } },
    orderBy: { account: { code: 'asc' } },
  });
}

// Solo tiene sentido clasificar cuentas de GASTO (fijo/variable) — una
// cuenta de ingreso o de balance no participa del Punto de Equilibrio.
async function setClassification(companyId, userId, accountId, costBehavior) {
  const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
  if (!account) {
    throw new AppError('La cuenta indicada no existe en esta empresa.', 404, 'ACCOUNT_NOT_FOUND');
  }
  if (account.type !== 'EXPENSE') {
    throw new AppError('Solo se pueden clasificar cuentas de gasto como costo fijo o variable.', 400, 'ONLY_EXPENSE_ACCOUNTS');
  }

  return prisma.analysisCostClassification.upsert({
    where: { accountId },
    create: { companyId, accountId, costBehavior, updatedByUserId: userId },
    update: { costBehavior, updatedByUserId: userId },
  });
}

async function removeClassification(companyId, accountId) {
  const existing = await prisma.analysisCostClassification.findFirst({ where: { accountId, companyId } });
  if (!existing) {
    throw new AppError('Esta cuenta no tiene una clasificación guardada.', 404, 'CLASSIFICATION_NOT_FOUND');
  }
  await prisma.analysisCostClassification.delete({ where: { accountId } });
}

module.exports = { listClassifications, setClassification, removeClassification };
