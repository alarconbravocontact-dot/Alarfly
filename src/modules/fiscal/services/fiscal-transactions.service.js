const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const taxRatesService = require('./tax-rates.service');
const riskRulesService = require('./fiscal-risk-rules.service');
const { buildFiscalTransactionLines } = require('./fiscal-transactions.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');

const { Decimal } = Prisma;

// Registra una venta o compra fiscal: resuelve el impuesto/retención
// aplicable (punto 1), corre las validaciones preventivas (punto 2), y
// postea el asiento contable a través del motor de asientos de
// Contabilidad — este servicio NUNCA escribe JournalEntry directo ni
// vuelve a validar partida doble, eso ya lo hace core/ledger.
//
// `tx` (Fase 1 — Unit of Work): opcional. AR/AP lo pasan para que el
// asiento, la FiscalTransaction y su propia factura queden en una sola
// transacción (antes eran 3 transacciones independientes: Ledger,
// FiscalTransaction, factura). Si no se pasa, se comporta igual que
// siempre (abre su propia transacción).
async function createFiscalTransaction(companyId, userId, data, tx = null) {
  const jurisdiction = await prisma.taxJurisdiction.findFirst({ where: { id: data.jurisdictionId, companyId } });
  if (!jurisdiction) {
    throw new AppError('La jurisdicción indicada no existe en esta empresa.', 400, 'JURISDICTION_NOT_FOUND');
  }

  let taxRate = null;
  let withholdingRate = null;

  if (data.taxRateId) {
    taxRate = await prisma.taxRate.findFirst({ where: { id: data.taxRateId, companyId, jurisdictionId: data.jurisdictionId } });
    if (!taxRate) {
      throw new AppError('La tasa de impuesto indicada no existe en esta jurisdicción.', 400, 'TAX_RATE_NOT_FOUND');
    }
  }
  if (data.withholdingRateId) {
    withholdingRate = await prisma.taxRate.findFirst({
      where: { id: data.withholdingRateId, companyId, jurisdictionId: data.jurisdictionId },
    });
    if (!withholdingRate) {
      throw new AppError('La tasa de retención indicada no existe en esta jurisdicción.', 400, 'WITHHOLDING_RATE_NOT_FOUND');
    }
  }

  if (!data.taxRateId || !data.withholdingRateId) {
    const resolved = await taxRatesService.resolveApplicableTax(companyId, {
      jurisdictionId: data.jurisdictionId,
      transactionType: data.type,
      date: data.date,
    });
    if (!data.taxRateId) taxRate = resolved.taxRate;
    if (!data.withholdingRateId) withholdingRate = resolved.withholdingRate;
  }

  const taxBase = new Decimal(data.taxBase);
  const taxAmount = taxRate ? taxBase.times(taxRate.rate).dividedBy(100).toDecimalPlaces(2) : new Decimal(0);
  const withholdingAmount = withholdingRate
    ? taxBase.times(withholdingRate.rate).dividedBy(100).toDecimalPlaces(2)
    : new Decimal(0);

  const taxAccountId = data.taxAccountId || taxRate?.glAccountId || null;
  const withholdingAccountId = data.withholdingAccountId || withholdingRate?.glAccountId || null;

  // Punto 2: validaciones fiscales preventivas, antes de tocar contabilidad.
  const context = {
    type: data.type,
    taxBase: taxBase.toNumber(),
    taxAmount: taxAmount.toNumber(),
    withholdingAmount: withholdingAmount.toNumber(),
    counterpartyTaxId: data.counterpartyTaxId,
    hasWithholding: withholdingAmount.greaterThan(0),
  };
  const { blocking, warnings } = await riskRulesService.evaluateTransaction(companyId, context);

  if (blocking.length > 0) {
    await auditService.log({
      companyId,
      userId,
      action: 'fiscal_risk.blocked',
      entityType: 'FiscalRiskRule',
      entityId: blocking[0].id,
      oldValue: null,
      newValue: { rules: blocking.map((rule) => rule.name), context },
    });
    throw new AppError(
      `La transacción fue bloqueada por reglas fiscales: ${blocking.map((rule) => rule.name).join(', ')}.`,
      409,
      'FISCAL_RISK_BLOCKED'
    );
  }

  const lines = buildFiscalTransactionLines({
    type: data.type,
    taxBase,
    taxAmount,
    withholdingAmount,
    taxBaseAccountId: data.taxBaseAccountId,
    counterpartyAccountId: data.counterpartyAccountId,
    taxAccountId,
    withholdingAccountId,
  });

  async function run(client) {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: data.date,
        description: data.description || `${data.type === 'SALE' ? 'Venta' : 'Compra'} fiscal — ${data.counterpartyName}`,
        lines: lines.map((line) => ({ accountId: line.accountId, debit: line.debit.toNumber(), credit: line.credit.toNumber() })),
        origin: 'AUTOMATIC',
        sourceModule: 'fiscal',
        createdByUserId: userId,
        autoApprove: true,
      },
      client
    );

    const fiscalTransaction = await client.fiscalTransaction.create({
      data: {
        companyId,
        type: data.type,
        journalEntryId: entry.id,
        jurisdictionId: data.jurisdictionId,
        counterpartyName: data.counterpartyName,
        counterpartyTaxId: data.counterpartyTaxId,
        documentNumber: data.documentNumber || null,
        date: data.date,
        taxBase,
        taxRateId: taxRate?.id || null,
        taxAmount,
        withholdingRateId: withholdingRate?.id || null,
        withholdingAmount,
        createdByUserId: userId,
      },
    });

    for (const warning of warnings) {
      await client.fiscalRiskAlert.create({
        data: {
          companyId,
          ruleId: warning.id,
          fiscalTransactionId: fiscalTransaction.id,
          severity: 'WARNING',
          message: `Se activó la regla "${warning.name}".`,
          wasBlocked: false,
        },
      });
      await auditService.log(
        {
          companyId,
          userId,
          action: 'fiscal_risk.warning_detected',
          entityType: 'FiscalTransaction',
          entityId: fiscalTransaction.id,
          oldValue: null,
          newValue: { rule: warning.name },
        },
        client
      );
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'fiscal_transaction.created',
        entityType: 'FiscalTransaction',
        entityId: fiscalTransaction.id,
        oldValue: null,
        newValue: fiscalTransaction,
      },
      client
    );

    // F17-E16: se devuelven también las líneas del asiento recién
    // posteado (`entry.lines`, ya las traía `postEntry`) — AR las
    // necesita para poder etiquetar la línea de ingreso de una factura
    // con la misma FpaDimension del producto, sin tener que volver a
    // leer el asiento con una segunda consulta.
    return { ...fiscalTransaction, warnings: warnings.map((rule) => rule.name), journalEntryLines: entry.lines };
  }

  return withTransaction(run, tx);
}

async function getFiscalTransaction(companyId, id) {
  const transaction = await prisma.fiscalTransaction.findFirst({
    where: { id, companyId },
    include: { journalEntry: true, jurisdiction: true, taxRate: true, withholdingRate: true, riskAlerts: true },
  });
  if (!transaction) {
    throw new AppError('La transacción fiscal indicada no existe.', 404, 'FISCAL_TRANSACTION_NOT_FOUND');
  }
  return transaction;
}

async function listFiscalTransactions(companyId, { type, from, to } = {}) {
  return prisma.fiscalTransaction.findMany({
    where: { companyId, type: type || undefined, date: from || to ? { gte: from, lte: to } : undefined },
    orderBy: { date: 'desc' },
  });
}

module.exports = { createFiscalTransaction, getFiscalTransaction, listFiscalTransactions };
