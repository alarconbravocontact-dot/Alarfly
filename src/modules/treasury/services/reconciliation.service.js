const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const periodLockService = require('../../../core/period-lock/period-lock.service');
const { assertPeriodOpen } = require('../../../core/period-lock/period-lock.rules');
const { findAutomaticMatches } = require('./reconciliation.rules');

async function startReconciliation(companyId, userId, data) {
  const treasuryAccount = await prisma.treasuryAccount.findFirst({
    where: { id: data.treasuryAccountId, companyId },
  });
  if (!treasuryAccount) {
    throw new AppError('La cuenta de tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const reconciliation = await tx.bankReconciliation.create({
      data: {
        companyId,
        treasuryAccountId: data.treasuryAccountId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        statementStartingBalance: data.statementStartingBalance,
        statementEndingBalance: data.statementEndingBalance,
        createdByUserId: userId,
      },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'bank_reconciliation.started',
        entityType: 'BankReconciliation',
        entityId: reconciliation.id,
        oldValue: null,
        newValue: reconciliation,
      },
      tx
    );
    return reconciliation;
  });
}

async function getReconciliation(companyId, id) {
  const reconciliation = await prisma.bankReconciliation.findFirst({
    where: { id, companyId },
    include: { treasuryAccount: true, matches: { include: { bankTransaction: true, journalEntryLine: true } } },
  });
  if (!reconciliation) {
    throw new AppError('La conciliación indicada no existe.', 404, 'RECONCILIATION_NOT_FOUND');
  }
  return reconciliation;
}

async function listReconciliations(companyId, treasuryAccountId) {
  return prisma.bankReconciliation.findMany({
    where: { companyId, treasuryAccountId: treasuryAccountId || undefined },
    orderBy: { createdAt: 'desc' },
  });
}

// Corre el emparejamiento automático contra las líneas del mayor de la
// cuenta contable ligada a esta cuenta de tesorería, dentro del rango
// de fechas de la conciliación. Solo empareja contra asientos que YA
// existen; nunca crea asientos aquí (eso solo pasa en el emparejamiento
// manual, cuando un humano confirma que hace falta uno nuevo).
async function runAutomaticMatching(companyId, reconciliationId, userId) {
  const reconciliation = await prisma.bankReconciliation.findFirst({
    where: { id: reconciliationId, companyId },
    include: { treasuryAccount: true },
  });
  if (!reconciliation) {
    throw new AppError('La conciliación indicada no existe.', 404, 'RECONCILIATION_NOT_FOUND');
  }
  if (reconciliation.status !== 'IN_PROGRESS') {
    throw new AppError('Esta conciliación ya está completada.', 409, 'RECONCILIATION_NOT_IN_PROGRESS');
  }

  const settings = await prisma.treasurySettings.findUnique({ where: { companyId } });
  const toleranceDays = settings?.reconciliationToleranceDays ?? 3;
  const amountTolerance = settings?.reconciliationAmountTolerance ?? 0;

  const bankTransactions = await prisma.bankTransaction.findMany({
    where: {
      companyId,
      treasuryAccountId: reconciliation.treasuryAccountId,
      status: 'UNMATCHED',
      date: { gte: reconciliation.periodStart, lte: reconciliation.periodEnd },
    },
  });

  const alreadyMatchedLineIds = (
    await prisma.reconciliationMatch.findMany({
      where: { status: 'ACTIVE', reconciliation: { companyId } },
      select: { journalEntryLineId: true },
    })
  ).map((m) => m.journalEntryLineId);

  const candidateLines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: reconciliation.treasuryAccount.glAccountId,
      id: { notIn: alreadyMatchedLineIds },
      journalEntry: { companyId, status: 'APPROVED' },
    },
    include: { journalEntry: { select: { date: true } } },
  });
  const candidatesWithDate = candidateLines.map((line) => ({ ...line, date: line.journalEntry.date }));

  const matches = findAutomaticMatches(bankTransactions, candidatesWithDate, { toleranceDays, amountTolerance });

  const created = [];
  await prisma.$transaction(async (tx) => {
    for (const match of matches) {
      const reconciliationMatch = await tx.reconciliationMatch.create({
        data: {
          reconciliationId,
          bankTransactionId: match.bankTransactionId,
          journalEntryLineId: match.journalEntryLineId,
          matchType: 'AUTOMATIC',
          toleranceDaysUsed: match.dayDiff,
        },
      });
      await tx.bankTransaction.update({
        where: { id: match.bankTransactionId },
        data: { status: 'MATCHED', matchedJournalEntryLineId: match.journalEntryLineId },
      });
      created.push(reconciliationMatch);
    }

    if (created.length > 0) {
      await auditService.log(
        {
          companyId,
          userId,
          action: 'bank_reconciliation.auto_matched',
          entityType: 'BankReconciliation',
          entityId: reconciliationId,
          oldValue: null,
          newValue: { matched: created.length },
        },
        tx
      );
    }
  });

  const remainingUnmatched = bankTransactions.length - created.length;
  return { matched: created.length, remainingUnmatched };
}

async function manualMatch(companyId, reconciliationId, userId, { bankTransactionId, journalEntryLineId }) {
  const reconciliation = await prisma.bankReconciliation.findFirst({ where: { id: reconciliationId, companyId } });
  if (!reconciliation) {
    throw new AppError('La conciliación indicada no existe.', 404, 'RECONCILIATION_NOT_FOUND');
  }

  const bankTransaction = await prisma.bankTransaction.findFirst({
    where: { id: bankTransactionId, companyId, treasuryAccountId: reconciliation.treasuryAccountId },
  });
  if (!bankTransaction) {
    throw new AppError('El movimiento bancario indicado no existe.', 404, 'BANK_TRANSACTION_NOT_FOUND');
  }
  if (bankTransaction.status === 'MATCHED') {
    throw new AppError('Este movimiento ya está conciliado.', 409, 'ALREADY_MATCHED');
  }

  const line = await prisma.journalEntryLine.findFirst({ where: { id: journalEntryLineId } });
  if (!line) {
    throw new AppError('La línea contable indicada no existe.', 404, 'JOURNAL_ENTRY_LINE_NOT_FOUND');
  }
  const existingActiveMatch = await prisma.reconciliationMatch.findFirst({
    where: { journalEntryLineId, status: 'ACTIVE' },
  });
  if (existingActiveMatch) {
    throw new AppError('Esa línea contable ya está conciliada con otro movimiento.', 409, 'LINE_ALREADY_MATCHED');
  }

  return prisma.$transaction(async (tx) => {
    const match = await tx.reconciliationMatch.create({
      data: {
        reconciliationId,
        bankTransactionId,
        journalEntryLineId,
        matchType: 'MANUAL',
        matchedByUserId: userId,
      },
    });
    await tx.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { status: 'MATCHED', matchedJournalEntryLineId: journalEntryLineId },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'bank_reconciliation.manual_matched',
        entityType: 'ReconciliationMatch',
        entityId: match.id,
        oldValue: null,
        newValue: match,
      },
      tx
    );
    return match;
  });
}

// Cuando el movimiento bancario no tiene un asiento contable previo
// (ej: un cargo de banco que nunca se registró), se genera uno nuevo a
// través del motor de asientos del core y se concilia contra esa línea
// recién creada. Respeta el bloqueo de periodo: si está cerrado, falla
// con un error claro en vez de forzar el asiento.
async function matchWithNewEntry(companyId, reconciliationId, userId, { bankTransactionId, offsetAccountId, description }) {
  const reconciliation = await prisma.bankReconciliation.findFirst({
    where: { id: reconciliationId, companyId },
    include: { treasuryAccount: true },
  });
  if (!reconciliation) {
    throw new AppError('La conciliación indicada no existe.', 404, 'RECONCILIATION_NOT_FOUND');
  }

  const bankTransaction = await prisma.bankTransaction.findFirst({
    where: { id: bankTransactionId, companyId, treasuryAccountId: reconciliation.treasuryAccountId },
  });
  if (!bankTransaction) {
    throw new AppError('El movimiento bancario indicado no existe.', 404, 'BANK_TRANSACTION_NOT_FOUND');
  }
  if (bankTransaction.status === 'MATCHED') {
    throw new AppError('Este movimiento ya está conciliado.', 409, 'ALREADY_MATCHED');
  }

  const period = await periodLockService.getPeriodForDate(companyId, bankTransaction.date);
  assertPeriodOpen(period);

  const glAccountId = reconciliation.treasuryAccount.glAccountId;
  const isInflow = Number(bankTransaction.amount) >= 0;
  const amount = Math.abs(Number(bankTransaction.amount));

  // Fase 1 — Unit of Work: el asiento, el emparejamiento y el único
  // incremento legítimo de TreasuryAccount.currentBalance por un
  // movimiento bancario (este SÍ es dinero real sin ningún registro
  // previo en Alarfly, a diferencia de la importación del extracto, que
  // ya no toca el saldo — ver statement-import.service.js) quedan en la
  // MISMA transacción: si algo falla, no queda ni asiento huérfano ni
  // saldo actualizado sin su asiento.
  return prisma.$transaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: bankTransaction.date,
        description: description || bankTransaction.description,
        lines: isInflow
          ? [
              { accountId: glAccountId, debit: amount, credit: 0 },
              { accountId: offsetAccountId, debit: 0, credit: amount },
            ]
          : [
              { accountId: offsetAccountId, debit: amount, credit: 0 },
              { accountId: glAccountId, debit: 0, credit: amount },
            ],
        origin: 'AUTOMATIC',
        sourceModule: 'treasury',
        sourceReference: bankTransactionId,
        createdByUserId: userId,
        autoApprove: true,
      },
      tx
    );

    const glAccountLine = entry.lines.find((line) => line.accountId === glAccountId);

    const match = await tx.reconciliationMatch.create({
      data: {
        reconciliationId,
        bankTransactionId,
        journalEntryLineId: glAccountLine.id,
        matchType: 'MANUAL',
        matchedByUserId: userId,
        generatedNewEntry: true,
      },
    });
    await tx.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { status: 'MATCHED', matchedJournalEntryLineId: glAccountLine.id },
    });
    await tx.treasuryAccount.update({
      where: { id: reconciliation.treasuryAccountId },
      data: { currentBalance: isInflow ? { increment: amount } : { decrement: amount } },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'bank_reconciliation.entry_generated',
        entityType: 'ReconciliationMatch',
        entityId: match.id,
        oldValue: null,
        newValue: { match, journalEntryId: entry.id },
      },
      tx
    );
    return { match, journalEntry: entry };
  });
}

// Deshacer un emparejamiento (punto 11 de Fase 5). Dos casos, según
// cómo se haya creado el match (ver `generatedNewEntry`):
//  - Emparejó contra un asiento YA EXISTENTE (runAutomaticMatching/
//    manualMatch): ese asiento nunca tocó TreasuryAccount.currentBalance
//    ni lo generó esta conciliación — deshacer el match solo desemparaja,
//    el asiento sigue existiendo tal cual (es de otro origen, ej. un
//    ArPayment real).
//  - Generó un asiento NUEVO (matchWithNewEntry), que SÍ ajustó
//    currentBalance en el momento del match: deshacerlo debe reversar
//    ese asiento (vía core/ledger.reverseEntry, nunca editar/borrar el
//    original) Y devolver currentBalance exactamente a como estaba —
//    todo en una sola transacción, con una reversión doble bloqueada de
//    forma atómica (updateMany condicionado al estado ACTIVE, no un
//    read-then-write separado que pueda perder una carrera).
async function reverseMatch(companyId, reconciliationId, userId, matchId) {
  const match = await prisma.reconciliationMatch.findFirst({
    where: { id: matchId, reconciliationId, reconciliation: { companyId } },
    include: { bankTransaction: true, journalEntryLine: true },
  });
  if (!match) {
    throw new AppError('El emparejamiento indicado no existe.', 404, 'MATCH_NOT_FOUND');
  }
  if (match.status === 'REVERSED') {
    throw new AppError('Este emparejamiento ya fue deshecho.', 409, 'ALREADY_REVERSED');
  }

  return prisma.$transaction(async (tx) => {
    // Reclamo atómico: si otra petición ya lo reversó entre el `findFirst`
    // de arriba y este punto, `count` da 0 y se rechaza — nunca dos
    // reversiones aplicadas sobre el mismo match.
    const claim = await tx.reconciliationMatch.updateMany({
      where: { id: matchId, status: 'ACTIVE' },
      data: { status: 'REVERSED' },
    });
    if (claim.count === 0) {
      throw new AppError('Este emparejamiento ya fue deshecho.', 409, 'ALREADY_REVERSED');
    }

    await tx.bankTransaction.update({
      where: { id: match.bankTransactionId },
      data: { status: 'UNMATCHED', matchedJournalEntryLineId: null },
    });

    let reversalEntry = null;
    if (match.generatedNewEntry) {
      reversalEntry = await ledgerService.reverseEntry(
        companyId,
        match.journalEntryLine.journalEntryId,
        userId,
        { date: new Date(), description: `Reverso por deshacer conciliación (movimiento ${match.bankTransactionId})` },
        tx
      );

      const isInflow = Number(match.bankTransaction.amount) >= 0;
      const amount = Math.abs(Number(match.bankTransaction.amount));
      await tx.treasuryAccount.update({
        where: { id: match.bankTransaction.treasuryAccountId },
        // Exactamente lo opuesto de lo que hizo matchWithNewEntry al
        // crear este match — nunca se recalcula el saldo desde cero.
        data: { currentBalance: isInflow ? { decrement: amount } : { increment: amount } },
      });
    }

    const updated = await tx.reconciliationMatch.findUnique({ where: { id: matchId } });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'bank_reconciliation.match_reversed',
        entityType: 'ReconciliationMatch',
        entityId: matchId,
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'REVERSED', reversedJournalEntryId: reversalEntry?.id || null },
      },
      tx
    );
    return updated;
  });
}

async function completeReconciliation(companyId, reconciliationId, userId) {
  const reconciliation = await prisma.bankReconciliation.findFirst({ where: { id: reconciliationId, companyId } });
  if (!reconciliation) {
    throw new AppError('La conciliación indicada no existe.', 404, 'RECONCILIATION_NOT_FOUND');
  }
  if (reconciliation.status === 'COMPLETED') {
    throw new AppError('Esta conciliación ya está completada.', 409, 'ALREADY_COMPLETED');
  }

  const treasuryAccount = await prisma.treasuryAccount.findUnique({ where: { id: reconciliation.treasuryAccountId } });
  const balanceDiscrepancy = treasuryAccount.currentBalance.minus(reconciliation.statementEndingBalance).toFixed(2);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bankReconciliation.update({
      where: { id: reconciliationId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'bank_reconciliation.completed',
        entityType: 'BankReconciliation',
        entityId: reconciliationId,
        oldValue: { status: 'IN_PROGRESS' },
        newValue: { status: 'COMPLETED', balanceDiscrepancy },
      },
      tx
    );
    return { reconciliation: updated, balanceDiscrepancy };
  });
}

async function listExceptions(companyId, treasuryAccountId) {
  return prisma.bankTransaction.findMany({
    where: { companyId, treasuryAccountId: treasuryAccountId || undefined, status: 'UNMATCHED' },
    orderBy: { date: 'asc' },
  });
}

module.exports = {
  startReconciliation,
  getReconciliation,
  listReconciliations,
  runAutomaticMatching,
  manualMatch,
  matchWithNewEntry,
  reverseMatch,
  completeReconciliation,
  listExceptions,
};
