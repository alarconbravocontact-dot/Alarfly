const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { getParser } = require('./parsers');

async function importBankStatement(companyId, userId, { treasuryAccountId, source, fileName, fileContent }) {
  const treasuryAccount = await prisma.treasuryAccount.findFirst({ where: { id: treasuryAccountId, companyId } });
  if (!treasuryAccount) {
    throw new AppError('La cuenta de tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }

  const parser = getParser(source);

  let normalizedTransactions;
  try {
    normalizedTransactions = parser(fileContent);
  } catch (err) {
    await prisma.statementImport.create({
      data: {
        companyId,
        treasuryAccountId,
        source,
        fileName,
        status: 'FAILED',
        errorMessage: err.message,
        importedByUserId: userId,
      },
    });
    throw new AppError(`No se pudo leer el archivo: ${err.message}`, 400, 'IMPORT_PARSE_FAILED');
  }

  if (normalizedTransactions.length === 0) {
    throw new AppError('El archivo no contiene movimientos para importar.', 400, 'EMPTY_STATEMENT');
  }

  return prisma.$transaction(async (tx) => {
    const importRecord = await tx.statementImport.create({
      data: { companyId, treasuryAccountId, source, fileName, status: 'PROCESSED', importedByUserId: userId },
    });

    let imported = 0;
    let skipped = 0;

    // Fase 1 — corrección de doble contabilización: importar un
    // extracto NUNCA toca TreasuryAccount.currentBalance. El saldo ya
    // refleja cada movimiento operativo (cobro, pago, orden de pago,
    // deuda, caja chica) en el momento en que se registró en Alarfly —
    // volver a sumarlo aquí, solo porque el mismo movimiento aparece
    // ahora en el extracto, lo contaba dos veces. La importación solo
    // trae los BankTransaction en bruto para que la conciliación los
    // empareje contra lo que ya existe; el único lugar donde un
    // movimiento bancario puede afectar el saldo es
    // reconciliation.service.matchWithNewEntry, cuando un humano
    // confirma que ESE movimiento no tiene ningún asiento previo —ver
    // PROGRESS_LOG.md, Fase 1, sección Treasury.
    for (const txn of normalizedTransactions) {
      if (txn.externalId) {
        const existing = await tx.bankTransaction.findUnique({
          where: { treasuryAccountId_externalId: { treasuryAccountId, externalId: txn.externalId } },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
      }

      await tx.bankTransaction.create({
        data: {
          companyId,
          treasuryAccountId,
          importId: importRecord.id,
          externalId: txn.externalId || null,
          date: txn.date,
          description: txn.description,
          reference: txn.reference || null,
          amount: txn.amount,
          currency: treasuryAccount.currency,
          rawPayload: txn.rawPayload || undefined,
        },
      });
      imported += 1;
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'statement_import.processed',
        entityType: 'StatementImport',
        entityId: importRecord.id,
        oldValue: null,
        newValue: { imported, skipped, source },
      },
      tx
    );

    return { import: importRecord, transactionsImported: imported, transactionsSkipped: skipped };
  });
}

async function listImports(companyId, treasuryAccountId) {
  return prisma.statementImport.findMany({
    where: { companyId, treasuryAccountId: treasuryAccountId || undefined },
    orderBy: { createdAt: 'desc' },
  });
}

async function listBankTransactions(companyId, { treasuryAccountId, status } = {}) {
  return prisma.bankTransaction.findMany({
    where: { companyId, treasuryAccountId: treasuryAccountId || undefined, status: status || undefined },
    orderBy: { date: 'desc' },
  });
}

module.exports = { importBankStatement, listImports, listBankTransactions };
