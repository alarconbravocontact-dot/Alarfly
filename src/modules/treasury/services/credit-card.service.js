const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { getParser } = require('./parsers');

const { Decimal } = Prisma;

// Importa un estado de cuenta de tarjeta (CSV por ahora).
async function importCardStatement(companyId, userId, { treasuryAccountId, fileName, fileContent }) {
  const treasuryAccount = await prisma.treasuryAccount.findFirst({
    where: { id: treasuryAccountId, companyId, type: 'CREDIT_CARD' },
  });
  if (!treasuryAccount) {
    throw new AppError('La tarjeta de crédito indicada no existe.', 404, 'CREDIT_CARD_NOT_FOUND');
  }

  const parser = getParser('CSV');
  let normalizedTransactions;
  try {
    normalizedTransactions = parser(fileContent);
  } catch (err) {
    throw new AppError(`No se pudo leer el archivo: ${err.message}`, 400, 'IMPORT_PARSE_FAILED');
  }

  if (normalizedTransactions.length === 0) {
    throw new AppError('El archivo no contiene movimientos para importar.', 400, 'EMPTY_STATEMENT');
  }

  return prisma.$transaction(async (tx) => {
    const importRecord = await tx.statementImport.create({
      data: {
        companyId,
        treasuryAccountId,
        source: 'CSV',
        fileName,
        status: 'PROCESSED',
        importedByUserId: userId,
      },
    });

    const created = await tx.creditCardTransaction.createMany({
      data: normalizedTransactions.map((txn) => ({
        companyId,
        treasuryAccountId,
        importId: importRecord.id,
        date: txn.date,
        merchant: txn.description,
        amount: txn.amount,
        currency: treasuryAccount.currency,
        rawPayload: txn.rawPayload || undefined,
      })),
    });

    // A diferencia de una cuenta bancaria, en una tarjeta el signo es al
    // revés: una compra (monto negativo en el estado de cuenta) aumenta
    // lo que se debe. currentBalance en una CREDIT_CARD representa la
    // deuda usada, igual que Debt.outstandingBalance en una línea de
    // crédito.
    const debtChange = normalizedTransactions.reduce((sum, txn) => sum.minus(txn.amount), new Decimal(0));
    if (!debtChange.isZero()) {
      await tx.treasuryAccount.update({
        where: { id: treasuryAccountId },
        data: { currentBalance: { increment: debtChange } },
      });
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'credit_card_statement.processed',
        entityType: 'StatementImport',
        entityId: importRecord.id,
        oldValue: null,
        newValue: { imported: created.count },
      },
      tx
    );

    return { import: importRecord, transactionsImported: created.count };
  });
}

async function listCardTransactions(companyId, { treasuryAccountId, matchStatus } = {}) {
  return prisma.creditCardTransaction.findMany({
    where: { companyId, treasuryAccountId: treasuryAccountId || undefined, matchStatus: matchStatus || undefined },
    orderBy: { date: 'desc' },
  });
}

async function flagTransaction(companyId, id, userId, { hasReceipt, isPolicyViolation }) {
  const transaction = await prisma.creditCardTransaction.findFirst({ where: { id, companyId } });
  if (!transaction) {
    throw new AppError('El movimiento de tarjeta indicado no existe.', 404, 'CREDIT_CARD_TRANSACTION_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.creditCardTransaction.update({
      where: { id },
      data: { hasReceipt, isPolicyViolation },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'credit_card_transaction.flagged',
        entityType: 'CreditCardTransaction',
        entityId: id,
        oldValue: { hasReceipt: transaction.hasReceipt, isPolicyViolation: transaction.isPolicyViolation },
        newValue: { hasReceipt, isPolicyViolation },
      },
      tx
    );
    return updated;
  });
}

// Conexión que quedó pendiente en el punto 4: cruzar manualmente una
// transacción de tarjeta contra el gasto de caja chica que la reportó
// (ahora que PettyCashExpense ya existe, punto 8).
async function matchWithPettyCashExpense(companyId, transactionId, userId, pettyCashExpenseId) {
  const transaction = await prisma.creditCardTransaction.findFirst({ where: { id: transactionId, companyId } });
  if (!transaction) {
    throw new AppError('El movimiento de tarjeta indicado no existe.', 404, 'CREDIT_CARD_TRANSACTION_NOT_FOUND');
  }
  const expense = await prisma.pettyCashExpense.findFirst({ where: { id: pettyCashExpenseId, companyId } });
  if (!expense) {
    throw new AppError('El gasto de caja chica indicado no existe.', 404, 'EXPENSE_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.creditCardTransaction.update({
      where: { id: transactionId },
      data: { matchStatus: 'MATCHED', matchedPettyCashExpenseId: pettyCashExpenseId, hasReceipt: true },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'credit_card_transaction.matched_petty_cash',
        entityType: 'CreditCardTransaction',
        entityId: transactionId,
        oldValue: { matchStatus: 'UNMATCHED' },
        newValue: { matchStatus: 'MATCHED', pettyCashExpenseId },
      },
      tx
    );
    return updated;
  });
}

module.exports = { importCardStatement, listCardTransactions, flagTransaction, matchWithPettyCashExpense };
