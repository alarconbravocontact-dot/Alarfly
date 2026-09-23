const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');
const { assertPeriodOpen, periodsOverlap } = require('./period-lock.rules');

async function createPeriod({ companyId, name, startDate, endDate }) {
  if (startDate > endDate) {
    throw new AppError('La fecha de inicio no puede ser después de la fecha de fin.', 400, 'INVALID_DATE_RANGE');
  }

  const existing = await prisma.accountingPeriod.findMany({ where: { companyId } });
  const overlaps = existing.some((p) => periodsOverlap(p, { startDate, endDate }));
  if (overlaps) {
    throw new AppError('Ya existe un periodo contable que se cruza con esas fechas.', 409, 'PERIOD_OVERLAP');
  }

  return prisma.accountingPeriod.create({ data: { companyId, name, startDate, endDate } });
}

async function listPeriods(companyId) {
  return prisma.accountingPeriod.findMany({ where: { companyId }, orderBy: { startDate: 'asc' } });
}

async function getPeriodForDate(companyId, date) {
  const period = await prisma.accountingPeriod.findFirst({
    where: { companyId, startDate: { lte: date }, endDate: { gte: date } },
  });
  if (!period) {
    throw new AppError(
      'No hay un periodo contable creado que cubra esa fecha.',
      404,
      'PERIOD_NOT_FOUND'
    );
  }
  return period;
}

async function assertOpenForDate(companyId, date) {
  const period = await getPeriodForDate(companyId, date);
  assertPeriodOpen(period);
  return period;
}

async function closePeriod(companyId, periodId, userId) {
  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, companyId } });
  if (!period) {
    throw new AppError('El periodo contable indicado no existe.', 404, 'PERIOD_NOT_FOUND');
  }
  if (period.status === 'CLOSED') {
    throw new AppError('Este periodo ya está cerrado.', 409, 'PERIOD_ALREADY_CLOSED');
  }

  const pendingEntries = await prisma.journalEntry.count({
    where: { companyId, periodId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
  });
  if (pendingEntries > 0) {
    throw new AppError(
      `Hay ${pendingEntries} asiento(s) sin aprobar en este periodo. Apruébalos o elimínalos antes de cerrar.`,
      409,
      'PERIOD_HAS_PENDING_ENTRIES'
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.accountingPeriod.update({
      where: { id: periodId },
      data: { status: 'CLOSED', closedAt: new Date(), closedByUserId: userId },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'period.closed',
        entityType: 'AccountingPeriod',
        entityId: periodId,
        oldValue: { status: 'OPEN' },
        newValue: { status: 'CLOSED' },
      },
      tx
    );

    return updated;
  });
}

async function reopenPeriod(companyId, periodId, userId, reason) {
  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, companyId } });
  if (!period) {
    throw new AppError('El periodo contable indicado no existe.', 404, 'PERIOD_NOT_FOUND');
  }
  if (period.status === 'OPEN') {
    throw new AppError('Este periodo ya está abierto.', 409, 'PERIOD_ALREADY_OPEN');
  }
  if (!reason) {
    throw new AppError('Debes indicar el motivo para reabrir el periodo.', 400, 'REASON_REQUIRED');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.accountingPeriod.update({
      where: { id: periodId },
      data: { status: 'OPEN', closedAt: null, closedByUserId: null },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'period.reopened',
        entityType: 'AccountingPeriod',
        entityId: periodId,
        oldValue: { status: 'CLOSED' },
        newValue: { status: 'OPEN', reason },
      },
      tx
    );

    return updated;
  });
}

module.exports = {
  createPeriod,
  listPeriods,
  getPeriodForDate,
  assertOpenForDate,
  closePeriod,
  reopenPeriod,
};
