const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { calculateNextDueDate } = require('./fiscal-obligations.rules');

async function createObligation(companyId, userId, data) {
  const jurisdiction = await prisma.taxJurisdiction.findFirst({ where: { id: data.jurisdictionId, companyId } });
  if (!jurisdiction) {
    throw new AppError('La jurisdicción indicada no existe en esta empresa.', 400, 'JURISDICTION_NOT_FOUND');
  }
  // Valida que la recurrencia esté bien formada apenas se guarda,
  // calculando una fecha de prueba (sin usarla para nada más).
  calculateNextDueDate(
    { recurrence: data.recurrence, dueDayOfMonth: data.dueDayOfMonth, dueMonth: data.dueMonth },
    new Date()
  );

  return prisma.$transaction(async (tx) => {
    const obligation = await tx.fiscalObligation.create({
      data: {
        companyId,
        jurisdictionId: data.jurisdictionId,
        name: data.name,
        description: data.description || null,
        recurrence: data.recurrence,
        dueDayOfMonth: data.dueDayOfMonth,
        dueMonth: data.dueMonth || null,
      },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fiscal_obligation.created',
        entityType: 'FiscalObligation',
        entityId: obligation.id,
        oldValue: null,
        newValue: obligation,
      },
      tx
    );
    return obligation;
  });
}

async function updateObligation(companyId, id, userId, changes) {
  const obligation = await prisma.fiscalObligation.findFirst({ where: { id, companyId } });
  if (!obligation) {
    throw new AppError('La obligación fiscal indicada no existe.', 404, 'OBLIGATION_NOT_FOUND');
  }

  const allowedChanges = {
    name: changes.name,
    description: changes.description,
    recurrence: changes.recurrence,
    dueDayOfMonth: changes.dueDayOfMonth,
    dueMonth: changes.dueMonth,
    isActive: changes.isActive,
  };

  calculateNextDueDate(
    {
      recurrence: allowedChanges.recurrence ?? obligation.recurrence,
      dueDayOfMonth: allowedChanges.dueDayOfMonth ?? obligation.dueDayOfMonth,
      dueMonth: allowedChanges.dueMonth ?? obligation.dueMonth,
    },
    new Date()
  );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fiscalObligation.update({ where: { id }, data: allowedChanges });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fiscal_obligation.updated',
        entityType: 'FiscalObligation',
        entityId: id,
        oldValue: obligation,
        newValue: updated,
      },
      tx
    );
    return updated;
  });
}

async function listObligations(companyId, { isActive, jurisdictionId } = {}) {
  const obligations = await prisma.fiscalObligation.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive, jurisdictionId: jurisdictionId || undefined },
    orderBy: { name: 'asc' },
  });
  const today = new Date();
  return obligations.map((obligation) => ({ ...obligation, nextDueDate: calculateNextDueDate(obligation, today) }));
}

module.exports = { createObligation, updateObligation, listObligations };
