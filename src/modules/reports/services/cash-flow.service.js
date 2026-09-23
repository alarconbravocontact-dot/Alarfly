// Estado de Flujo de Efectivo (método directo e indirecto). Este
// servicio NO recalcula partida doble ni reglas de negocio: solo agrupa
// movimientos ya contabilizados (JournalEntryLine, siempre APPROVED) por
// "balde" de cuenta, usando las relaciones que YA existen en Tesorería
// (qué cuenta es "efectivo": TreasuryAccount.glAccountId) y Contabilidad
// (qué cuenta es activo fijo o deuda: FixedAsset/Debt), y llama a
// accounting/reports.service para la utilidad del periodo — la misma
// fuente que ya usa el Estado de Resultados.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const reportsService = require('../../accounting/services/reports.service');
const { buildIndirectCashFlow } = require('./cash-flow.rules');
const { isDisconnected } = require('../../treasury/services/bank-sync.rules');

const { Decimal } = Prisma;

async function sumDebitCredit(companyId, accountIds, from, to) {
  if (accountIds.length === 0) return { debit: new Decimal(0), credit: new Decimal(0) };
  const result = await prisma.journalEntryLine.aggregate({
    where: {
      accountId: { in: accountIds },
      journalEntry: { companyId, status: 'APPROVED', date: { gt: from, lte: to } },
    },
    _sum: { debit: true, credit: true },
  });
  return { debit: new Decimal(result._sum.debit || 0), credit: new Decimal(result._sum.credit || 0) };
}

// Clasifica cada cuenta de la empresa en el "balde" que le corresponde
// para el flujo de efectivo, reutilizando relaciones que ya existen
// (nunca marcando cuentas a mano en una tabla nueva).
async function classifyAccounts(companyId) {
  const [treasuryAccounts, fixedAssets, debts, allAccounts] = await Promise.all([
    prisma.treasuryAccount.findMany({ where: { companyId }, select: { glAccountId: true } }),
    prisma.fixedAsset.findMany({
      where: { companyId },
      select: { assetAccountId: true, accumulatedDepreciationAccountId: true },
    }),
    prisma.debt.findMany({ where: { companyId }, select: { liabilityAccountId: true } }),
    prisma.account.findMany({ where: { companyId } }),
  ]);

  const cashAccountIds = [...new Set(treasuryAccounts.map((t) => t.glAccountId))];
  const fixedAssetGrossAccountIds = [...new Set(fixedAssets.map((f) => f.assetAccountId))];
  const accumDepAccountIds = [...new Set(fixedAssets.map((f) => f.accumulatedDepreciationAccountId))];
  const debtAccountIds = [...new Set(debts.map((d) => d.liabilityAccountId))];

  const classified = new Set([...cashAccountIds, ...fixedAssetGrossAccountIds, ...accumDepAccountIds, ...debtAccountIds]);
  const otherOpAssetAccountIds = allAccounts.filter((a) => a.type === 'ASSET' && !classified.has(a.id)).map((a) => a.id);
  const otherOpLiabAccountIds = allAccounts.filter((a) => a.type === 'LIABILITY' && !classified.has(a.id)).map((a) => a.id);
  const equityAccountIds = allAccounts.filter((a) => a.type === 'EQUITY').map((a) => a.id);

  return {
    accountsById: new Map(allAccounts.map((a) => [a.id, a])),
    cashAccountIds,
    fixedAssetGrossAccountIds,
    accumDepAccountIds,
    debtAccountIds,
    otherOpAssetAccountIds,
    otherOpLiabAccountIds,
    equityAccountIds,
  };
}

function bucketForAccount(accountId, buckets) {
  if (buckets.fixedAssetGrossAccountIds.includes(accountId)) return 'INVESTING';
  if (buckets.debtAccountIds.includes(accountId)) return 'FINANCING';
  if (buckets.equityAccountIds.includes(accountId)) return 'FINANCING';
  if (buckets.accumDepAccountIds.includes(accountId)) return 'OPERATING';
  return 'OPERATING';
}

// Método directo: recorre cada línea de efectivo del periodo y le
// atribuye su efecto (a favor o en contra) a la cuenta contraparte de su
// mismo asiento — si un asiento tiene varias contrapartes, se reparte a
// prorrata del monto de cada una. Es solo presentación (detalle de
// cobros/pagos); los totales por categoría que MANDAN son los del
// método indirecto (calculados por balance, ver cash-flow.rules.js).
async function buildDirectMethodDetail(companyId, cashAccountIds, buckets, from, to) {
  if (cashAccountIds.length === 0) return { operating: [], investing: [], financing: [] };

  const cashLines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: { in: cashAccountIds },
      journalEntry: { companyId, status: 'APPROVED', date: { gt: from, lte: to } },
    },
    include: { journalEntry: { include: { lines: true } } },
  });

  const byCategoryAndAccount = { OPERATING: new Map(), INVESTING: new Map(), FINANCING: new Map() };

  for (const cashLine of cashLines) {
    const cashEffect = new Decimal(cashLine.debit).minus(cashLine.credit);
    const counterparts = cashLine.journalEntry.lines.filter(
      (l) => l.id !== cashLine.id && !cashAccountIds.includes(l.accountId)
    );
    if (counterparts.length === 0) continue;

    const totalWeight = counterparts.reduce((sum, l) => sum.plus(new Decimal(l.debit).plus(l.credit).abs()), new Decimal(0));

    for (const counterpart of counterparts) {
      const weight = totalWeight.isZero()
        ? new Decimal(1).div(counterparts.length)
        : new Decimal(counterpart.debit).plus(counterpart.credit).abs().div(totalWeight);
      const share = cashEffect.times(weight);
      const category = bucketForAccount(counterpart.accountId, buckets);
      const account = buckets.accountsById.get(counterpart.accountId);
      const key = account ? account.code : counterpart.accountId;
      const map = byCategoryAndAccount[category];
      const prev = map.get(key) || {
        accountCode: account ? account.code : null,
        accountName: account ? account.name : 'Cuenta desconocida',
        netCashEffect: new Decimal(0),
      };
      prev.netCashEffect = prev.netCashEffect.plus(share);
      map.set(key, prev);
    }
  }

  const toArray = (map) =>
    [...map.values()]
      .map((row) => ({ ...row, netCashEffect: row.netCashEffect.toFixed(2) }))
      .sort((a, b) => Number(b.netCashEffect) - Number(a.netCashEffect));

  return {
    operating: toArray(byCategoryAndAccount.OPERATING),
    investing: toArray(byCategoryAndAccount.INVESTING),
    financing: toArray(byCategoryAndAccount.FINANCING),
  };
}

// Indicador de sincronización, la parte del reporte de flujo de caja:
// si alguna cuenta de tesorería que este reporte trata como "efectivo"
// (TreasuryAccount.glAccountId) lleva 48h+ sin un extracto importado,
// se avisa acá — mismo umbral y misma fuente que el indicador visual
// junto a cada cuenta en Cuentas y Caja, sin recalcular nada distinto.
async function getStaleCashAccounts(companyId) {
  const accounts = await prisma.treasuryAccount.findMany({
    where: { companyId, isActive: true },
    include: { statementImports: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const now = new Date();
  return accounts
    .filter((a) => isDisconnected(a.statementImports[0]?.createdAt || null, now))
    .map((a) => ({ treasuryAccountId: a.id, name: a.name, lastSyncAt: a.statementImports[0]?.createdAt || null }));
}

async function getCashFlowStatement(companyId, { from, to }) {
  const buckets = await classifyAccounts(companyId);

  const [
    cashSum,
    fixedAssetSum,
    accumDepSum,
    debtSum,
    otherOpAssetSum,
    otherOpLiabSum,
    equitySum,
    incomeStatement,
    staleCashAccounts,
  ] = await Promise.all([
    sumDebitCredit(companyId, buckets.cashAccountIds, from, to),
    sumDebitCredit(companyId, buckets.fixedAssetGrossAccountIds, from, to),
    sumDebitCredit(companyId, buckets.accumDepAccountIds, from, to),
    sumDebitCredit(companyId, buckets.debtAccountIds, from, to),
    sumDebitCredit(companyId, buckets.otherOpAssetAccountIds, from, to),
    sumDebitCredit(companyId, buckets.otherOpLiabAccountIds, from, to),
    sumDebitCredit(companyId, buckets.equityAccountIds, from, to),
    reportsService.getIncomeStatement(companyId, { from, to }),
    getStaleCashAccounts(companyId),
  ]);

  const indirect = buildIndirectCashFlow({
    netIncomePeriod: incomeStatement.netIncome,
    cashDebit: cashSum.debit,
    cashCredit: cashSum.credit,
    fixedAssetDebit: fixedAssetSum.debit,
    fixedAssetCredit: fixedAssetSum.credit,
    accumDepDebit: accumDepSum.debit,
    accumDepCredit: accumDepSum.credit,
    debtDebit: debtSum.debit,
    debtCredit: debtSum.credit,
    otherOpAssetDebit: otherOpAssetSum.debit,
    otherOpAssetCredit: otherOpAssetSum.credit,
    otherOpLiabDebit: otherOpLiabSum.debit,
    otherOpLiabCredit: otherOpLiabSum.credit,
    equityDebit: equitySum.debit,
    equityCredit: equitySum.credit,
  });

  const directDetail = await buildDirectMethodDetail(companyId, buckets.cashAccountIds, buckets, from, to);

  return {
    from,
    to,
    indirect,
    direct: {
      operating: directDetail.operating,
      investing: directDetail.investing,
      financing: directDetail.financing,
      netChangeInCash: indirect.netChangeInCash,
      actualCashDelta: indirect.actualCashDelta,
      reconciles: indirect.reconciles,
    },
    staleCashAccounts,
  };
}

module.exports = { getCashFlowStatement };
