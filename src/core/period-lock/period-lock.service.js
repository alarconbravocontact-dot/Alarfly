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

// `client`: opcional, mismo patrón "tx opcional" ya usado en todo el
// proyecto (core/ledger.postEntry, core/audit.log) — permite validar el
// periodo con el MISMO cliente transaccional que va a escribir el
// movimiento, en vez de con una consulta suelta antes de abrir la
// transacción (ver TOCTOU corregido en core/ledger.postEntry, Fase 11).
async function getPeriodForDate(companyId, date, client = prisma) {
  const period = await client.accountingPeriod.findFirst({
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

async function assertOpenForDate(companyId, date, client = prisma) {
  const period = await getPeriodForDate(companyId, date, client);
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

  // Fase 11 (sección 18, TOCTOU): la revalidación de "sin pendientes" se
  // repite DENTRO de la misma transacción que cierra el periodo, con el
  // cliente transaccional — un asiento que se cuele entre el chequeo de
  // arriba (solo para devolver un error temprano y legible) y el cierre
  // real ya no pasa desapercibido, porque se vuelve a contar justo antes
  // de escribir `status: CLOSED`.
  return prisma.$transaction(async (tx) => {
    const pendingEntries = await tx.journalEntry.count({
      where: { companyId, periodId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
    });
    if (pendingEntries > 0) {
      throw new AppError(
        `Hay ${pendingEntries} asiento(s) sin aprobar en este periodo. Apruébalos o elimínalos antes de cerrar.`,
        409,
        'PERIOD_HAS_PENDING_ENTRIES'
      );
    }

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
