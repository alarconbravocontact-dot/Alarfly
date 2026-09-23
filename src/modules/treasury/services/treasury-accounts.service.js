const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const fxService = require('../../../core/fx/fx.service');
const { computeSyncStatus } = require('./bank-sync.rules');

const { Decimal } = Prisma;

async function assertGlAccountUsable(companyId, glAccountId) {
  const account = await prisma.account.findFirst({ where: { id: glAccountId, companyId } });
  if (!account) {
    throw new AppError('La cuenta contable indicada no existe en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
  }
  if (!account.isPostable) {
    throw new AppError(`La cuenta "${account.name}" es agrupadora; no puede recibir movimientos.`, 400, 'ACCOUNT_NOT_POSTABLE');
  }
  return account;
}

async function assertBranchDimensionUsable(companyId, branchDimensionId) {
  if (!branchDimensionId) return;
  const dimension = await prisma.dimension.findFirst({ where: { id: branchDimensionId, companyId, type: 'BRANCH' } });
  if (!dimension) {
    throw new AppError('La sucursal indicada no existe (debe ser una dimensión de tipo BRANCH).', 400, 'BRANCH_NOT_FOUND');
  }
}

async function createTreasuryAccount(companyId, userId, data) {
  await assertGlAccountUsable(companyId, data.glAccountId);
  await assertBranchDimensionUsable(companyId, data.branchDimensionId);

  const existing = await prisma.treasuryAccount.findUnique({ where: { companyId_name: { companyId, name: data.name } } });
  if (existing) {
    throw new AppError(`Ya existe una cuenta de tesorería con el nombre "${data.name}".`, 409, 'TREASURY_ACCOUNT_EXISTS');
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.treasuryAccount.create({ data: { companyId, ...data } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'treasury_account.created',
        entityType: 'TreasuryAccount',
        entityId: account.id,
        oldValue: null,
        newValue: account,
      },
      tx
    );
    return account;
  });
}

async function updateTreasuryAccount(companyId, id, userId, changes) {
  const account = await prisma.treasuryAccount.findFirst({ where: { id, companyId } });
  if (!account) {
    throw new AppError('La cuenta de tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }
  if (changes.branchDimensionId !== undefined) {
    await assertBranchDimensionUsable(companyId, changes.branchDimensionId);
  }

  const allowedChanges = {
    name: changes.name,
    bankName: changes.bankName,
    accountNumber: changes.accountNumber,
    creditLimit: changes.creditLimit,
    lowBalanceThreshold: changes.lowBalanceThreshold,
    isActive: changes.isActive,
    branchDimensionId: changes.branchDimensionId,
  };

  return prisma.$transaction(async (tx) => {
    const updated = await tx.treasuryAccount.update({ where: { id }, data: allowedChanges });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'treasury_account.updated',
        entityType: 'TreasuryAccount',
        entityId: id,
        oldValue: account,
        newValue: updated,
      },
      tx
    );
    return updated;
  });
}

// El indicador de sincronización (verde/amarillo/rojo, junto a cada
// cuenta bancaria) se calcula acá, no se guarda: se deriva de la
// última importación real de extracto (`StatementImport.createdAt`),
// única fuente honesta que existe en el proyecto (no hay feed bancario
// en tiempo real, ver bank-sync.rules.js).
async function listTreasuryAccounts(companyId, { type, isActive } = {}) {
  const accounts = await prisma.treasuryAccount.findMany({
    where: { companyId, type: type || undefined, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
    include: { statementImports: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const now = new Date();
  return accounts.map(({ statementImports, ...account }) => {
    const lastSyncAt = statementImports[0]?.createdAt || null;
    return { ...account, lastSyncAt, syncStatus: computeSyncStatus(lastSyncAt, now) };
  });
}

async function getTreasuryAccount(companyId, id) {
  const account = await prisma.treasuryAccount.findFirst({ where: { id, companyId } });
  if (!account) {
    throw new AppError('La cuenta de tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }
  return account;
}

// Suma el saldo de todas las cuentas/tarjetas activas, convertido a la
// moneda base de la empresa con la tasa de cambio más reciente de cada
// moneda (core/fx). Si falta una tasa para alguna moneda, esa cuenta se
// reporta aparte en vez de romper todo el cálculo. Incluye además el
// "colchón de liquidez": lo disponible (sin usar) de las líneas de
// crédito activas, para que no haga falta mirar dos reportes distintos
// (punto 7, Gestión de Deuda).
async function convertToBase(companyId, baseCurrency, amount, currency, asOfDate, missingRates, refId) {
  if (currency === baseCurrency) return amount;
  try {
    const rate = await fxService.getLatestRate(companyId, currency, asOfDate);
    return amount.times(rate.rate);
  } catch {
    missingRates.push({ id: refId, currency });
    return null;
  }
}

async function getConsolidatedCashPosition(companyId, asOfDate = new Date()) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const accounts = await prisma.treasuryAccount.findMany({ where: { companyId, isActive: true } });
  const creditLines = await prisma.debt.findMany({ where: { companyId, type: 'CREDIT_LINE', status: 'ACTIVE' } });

  let totalInBaseCurrency = new Decimal(0);
  const byAccount = [];
  const missingRates = [];

  for (const account of accounts) {
    const converted = await convertToBase(
      companyId,
      company.baseCurrency,
      account.currentBalance,
      account.currency,
      asOfDate,
      missingRates,
      account.id
    );
    if (converted === null) {
      byAccount.push({ ...account, balanceInBaseCurrency: null });
      continue;
    }
    totalInBaseCurrency = totalInBaseCurrency.plus(converted);
    byAccount.push({ ...account, balanceInBaseCurrency: converted.toFixed(2) });
  }

  let availableCreditInBaseCurrency = new Decimal(0);
  const byCreditLine = [];
  for (const debt of creditLines) {
    const available = debt.principalAmount.minus(debt.outstandingBalance);
    const converted = await convertToBase(
      companyId,
      company.baseCurrency,
      available,
      debt.currency,
      asOfDate,
      missingRates,
      debt.id
    );
    if (converted === null) {
      byCreditLine.push({ id: debt.id, name: debt.name, available: available.toFixed(2), availableInBaseCurrency: null });
      continue;
    }
    availableCreditInBaseCurrency = availableCreditInBaseCurrency.plus(converted);
    byCreditLine.push({ id: debt.id, name: debt.name, available: available.toFixed(2), availableInBaseCurrency: converted.toFixed(2) });
  }

  return {
    asOfDate,
    baseCurrency: company.baseCurrency,
    totalInBaseCurrency: totalInBaseCurrency.toFixed(2),
    accounts: byAccount,
    availableCreditLines: byCreditLine,
    availableCreditInBaseCurrency: availableCreditInBaseCurrency.toFixed(2),
    liquidityCushion: totalInBaseCurrency.plus(availableCreditInBaseCurrency).toFixed(2),
    missingExchangeRates: missingRates,
  };
}

module.exports = {
  createTreasuryAccount,
  updateTreasuryAccount,
  listTreasuryAccounts,
  getTreasuryAccount,
  getConsolidatedCashPosition,
};
