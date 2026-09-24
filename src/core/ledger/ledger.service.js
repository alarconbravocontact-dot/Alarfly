const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');
const periodLockService = require('../period-lock/period-lock.service');
const { assertPeriodOpen } = require('../period-lock/period-lock.rules');
const { validateBalancedLines } = require('./ledger.rules');
const { withTransaction } = require('../database/unit-of-work');

async function getNextEntryNumber(tx, companyId) {
  const settings = await tx.accountingSettings.upsert({
    where: { companyId },
    update: { currentEntryNumberSequence: { increment: 1 } },
    create: { companyId, currentEntryNumberSequence: 1 },
  });
  return settings.currentEntryNumberSequence;
}

async function validateAccountsForPosting(tx, companyId, lines) {
  const accountIds = [...new Set(lines.map((line) => line.accountId))];
  const accounts = await tx.account.findMany({ where: { id: { in: accountIds }, companyId } });

  if (accounts.length !== accountIds.length) {
    throw new AppError('Una o más cuentas no existen en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
  }

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  for (const accountId of accountIds) {
    const account = accountsById.get(accountId);
    if (!account.isActive) {
      throw new AppError(
        `La cuenta "${account.name}" está inactiva y no puede recibir movimientos.`,
        400,
        'ACCOUNT_INACTIVE'
      );
    }
    if (!account.isPostable) {
      throw new AppError(
        `La cuenta "${account.name}" es una cuenta agrupadora; no puede recibir movimientos directamente.`,
        400,
        'ACCOUNT_NOT_POSTABLE'
      );
    }
  }
}

function buildLineCreateData(lines) {
  return lines.map((line, index) => ({
    accountId: line.accountId,
    debit: line.debit || 0,
    credit: line.credit || 0,
    foreignCurrency: line.foreignCurrency || null,
    foreignDebit: line.foreignDebit ?? null,
    foreignCredit: line.foreignCredit ?? null,
    exchangeRate: line.exchangeRate ?? null,
    description: line.description || null,
    order: index,
    dimensionTags: line.dimensionIds?.length
      ? { create: line.dimensionIds.map((dimensionId) => ({ dimensionId })) }
      : undefined,
  }));
}

// El único punto de entrada para crear movimientos contables. Todo
// módulo (Contabilidad, Tesorería, AR, AP, Inventario, Fiscal) pasa por
// aquí — nunca escriben JournalEntry directamente.
//
// `tx` (Fase 1 — Unit of Work): opcional, un cliente de transacción de
// Prisma ya abierto por el llamador. Si se pasa, postEntry participa de
// esa MISMA transacción en vez de abrir una propia — así el documento de
// negocio (factura, pago, movimiento de inventario...), su asiento y su
// auditoría quedan todos aplicados o ninguno. Si no se pasa, el
// comportamiento es idéntico al de siempre: postEntry abre su propia
// transacción. Ningún llamador existente que no pase `tx` cambia de
// comportamiento.
async function postEntry(
  {
    companyId,
    date,
    description,
    lines,
    origin = 'MANUAL',
    sourceModule = null,
    sourceReference = null,
    ruleId = null,
    createdByUserId,
    autoApprove = false,
  },
  tx = null
) {
  validateBalancedLines(lines);

  async function run(client) {
    // Fase 11 (sección 18, TOCTOU): el periodo se valida CON EL CLIENTE
    // TRANSACCIONAL, justo antes de escribir el asiento — no con una
    // consulta suelta antes de abrir la transacción. Antes de este fix,
    // otra petición podía cerrar el periodo en la ventana entre el
    // chequeo y el `journalEntry.create`, dejando un asiento posteado en
    // un periodo que quedaba cerrado sin que nadie lo notara.
    const period = await periodLockService.getPeriodForDate(companyId, date, client);
    assertPeriodOpen(period);

    const settings = await client.accountingSettings.findUnique({ where: { companyId } });
    const requiresApproval = settings?.requiresApprovalForManualEntries ?? false;
    const status = origin !== 'MANUAL' || autoApprove || !requiresApproval ? 'APPROVED' : 'DRAFT';

    await validateAccountsForPosting(client, companyId, lines);

    const entryNumber = await getNextEntryNumber(client, companyId);

    const entry = await client.journalEntry.create({
      data: {
        companyId,
        entryNumber,
        date,
        description,
        origin,
        sourceModule,
        sourceReference,
        ruleId,
        periodId: period.id,
        status,
        createdByUserId,
        approvedByUserId: status === 'APPROVED' ? createdByUserId : null,
        approvedAt: status === 'APPROVED' ? new Date() : null,
        lines: { create: buildLineCreateData(lines) },
      },
      include: { lines: true },
    });

    await auditService.log(
      {
        companyId,
        userId: createdByUserId,
        action: 'journal_entry.created',
        entityType: 'JournalEntry',
        entityId: entry.id,
        oldValue: null,
        newValue: { status: entry.status, entryNumber: entry.entryNumber },
      },
      client
    );

    return entry;
  }

  return withTransaction(run, tx);
}

async function submitForApproval(companyId, entryId, userId) {
  const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, companyId } });
  if (!entry) throw new AppError('El asiento indicado no existe.', 404, 'ENTRY_NOT_FOUND');
  if (entry.status !== 'DRAFT') {
    throw new AppError('Solo se pueden enviar a aprobación los asientos en borrador.', 409, 'INVALID_STATUS');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.journalEntry.update({
      where: { id: entryId },
      data: { status: 'PENDING_APPROVAL' },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'journal_entry.submitted',
        entityType: 'JournalEntry',
        entityId: entryId,
        oldValue: { status: 'DRAFT' },
        newValue: { status: 'PENDING_APPROVAL' },
      },
      tx
    );
    return updated;
  });
}

async function approveEntry(companyId, entryId, userId) {
  const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, companyId } });
  if (!entry) throw new AppError('El asiento indicado no existe.', 404, 'ENTRY_NOT_FOUND');
  if (entry.status !== 'PENDING_APPROVAL') {
    throw new AppError('Solo se pueden aprobar asientos que estén pendientes de aprobación.', 409, 'INVALID_STATUS');
  }

  const period = await prisma.accountingPeriod.findUnique({ where: { id: entry.periodId } });
  assertPeriodOpen(period);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.journalEntry.update({
      where: { id: entryId },
      data: { status: 'APPROVED', approvedByUserId: userId, approvedAt: new Date() },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'journal_entry.approved',
        entityType: 'JournalEntry',
        entityId: entryId,
        oldValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'APPROVED' },
      },
      tx
    );
    return updated;
  });
}

async function deleteDraft(companyId, entryId, userId) {
  const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, companyId } });
  if (!entry) throw new AppError('El asiento indicado no existe.', 404, 'ENTRY_NOT_FOUND');
  if (entry.status !== 'DRAFT') {
    throw new AppError('Solo se pueden eliminar asientos en borrador.', 409, 'INVALID_STATUS');
  }

  return prisma.$transaction(async (tx) => {
    await tx.journalEntry.delete({ where: { id: entryId } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'journal_entry.deleted',
        entityType: 'JournalEntry',
        entityId: entryId,
        oldValue: { status: 'DRAFT' },
        newValue: null,
      },
      tx
    );
  });
}

// Un asiento aprobado nunca se edita ni se borra: se reversa creando
// OTRO asiento con débitos y créditos invertidos, ligado al original.
// `tx` (Fase 5 — Unit of Work, mismo patrón ya usado en createEntry/
// createExit/createInvoice/createBill): opcional. Lo usa
// treasury/reconciliation.service.reverseMatch para que reversar el
// asiento auto-generado por una conciliación y ajustar
// TreasuryAccount.currentBalance queden en una sola transacción. Si no
// se pasa, se comporta igual que siempre (abre su propia transacción).
async function reverseEntry(companyId, entryId, userId, { date, description } = {}, tx = null) {
  const original = await prisma.journalEntry.findFirst({
    where: { id: entryId, companyId },
    include: { lines: { include: { dimensionTags: true }, orderBy: { order: 'asc' } } },
  });
  if (!original) throw new AppError('El asiento indicado no existe.', 404, 'ENTRY_NOT_FOUND');
  if (original.status !== 'APPROVED') {
    throw new AppError('Solo se pueden reversar asientos aprobados.', 409, 'INVALID_STATUS');
  }

  const existingReversal = await prisma.journalEntry.findFirst({ where: { reversalOfId: entryId } });
  if (existingReversal) {
    throw new AppError('Este asiento ya fue reversado.', 409, 'ALREADY_REVERSED');
  }

  const reversalDate = date || new Date();
  const period = await periodLockService.getPeriodForDate(companyId, reversalDate);
  assertPeriodOpen(period);

  return withTransaction(async (tx) => {
    const entryNumber = await getNextEntryNumber(tx, companyId);

    const reversal = await tx.journalEntry.create({
      data: {
        companyId,
        entryNumber,
        date: reversalDate,
        description: description || `Reverso del asiento #${original.entryNumber}: ${original.description}`,
        origin: original.origin,
        sourceModule: original.sourceModule,
        sourceReference: original.sourceReference,
        periodId: period.id,
        status: 'APPROVED',
        createdByUserId: userId,
        approvedByUserId: userId,
        approvedAt: new Date(),
        reversalOfId: original.id,
        lines: {
          create: original.lines.map((line, index) => ({
            accountId: line.accountId,
            debit: line.credit,
            credit: line.debit,
            foreignCurrency: line.foreignCurrency,
            foreignDebit: line.foreignCredit,
            foreignCredit: line.foreignDebit,
            exchangeRate: line.exchangeRate,
            description: line.description,
            order: index,
            dimensionTags: line.dimensionTags.length
              ? { create: line.dimensionTags.map((tag) => ({ dimensionId: tag.dimensionId })) }
              : undefined,
          })),
        },
      },
      include: { lines: true },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'journal_entry.reversed',
        entityType: 'JournalEntry',
        entityId: original.id,
        oldValue: { status: 'APPROVED' },
        newValue: { reversedByEntryId: reversal.id },
      },
      tx
    );

    return reversal;
  }, tx);
}

async function getEntry(companyId, entryId) {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, companyId },
    include: {
      lines: {
        include: { account: true, dimensionTags: { include: { dimension: true } } },
        orderBy: { order: 'asc' },
      },
      createdByUser: { select: { id: true, name: true } },
      approvedByUser: { select: { id: true, name: true } },
      period: true,
      reversalOf: { select: { id: true, entryNumber: true } },
      reversals: { select: { id: true, entryNumber: true } },
    },
  });
  if (!entry) throw new AppError('El asiento indicado no existe.', 404, 'ENTRY_NOT_FOUND');
  return entry;
}

async function listEntries(companyId, { from, to, status, periodId } = {}) {
  return prisma.journalEntry.findMany({
    where: {
      companyId,
      status: status || undefined,
      periodId: periodId || undefined,
      date: from || to ? { gte: from, lte: to } : undefined,
    },
    include: { lines: true },
    orderBy: [{ date: 'desc' }, { entryNumber: 'desc' }],
  });
}

module.exports = {
  postEntry,
  submitForApproval,
  approveEntry,
  deleteDraft,
  reverseEntry,
  getEntry,
  listEntries,
};
