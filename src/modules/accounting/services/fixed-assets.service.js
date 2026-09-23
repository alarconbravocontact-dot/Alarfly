const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const { calculateDepreciation } = require('./depreciation.rules');

const { Decimal } = Prisma;

async function assertAccountBelongsToCompany(companyId, accountId, label) {
  const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
  if (!account) {
    throw new AppError(`La cuenta indicada para "${label}" no existe en esta empresa.`, 400, 'ACCOUNT_NOT_FOUND');
  }
  return account;
}

async function createFixedAsset(companyId, userId, data) {
  if (data.depreciationMethod === 'UNITS_OF_PRODUCTION' && !data.totalUnitsOfProduction) {
    throw new AppError(
      'Los activos con método "por unidades de producción" necesitan indicar el total de unidades esperadas.',
      400,
      'MISSING_TOTAL_UNITS'
    );
  }
  if (new Decimal(data.salvageValue || 0).greaterThan(data.purchaseValue)) {
    throw new AppError('El valor residual no puede ser mayor que el valor de compra.', 400, 'INVALID_SALVAGE_VALUE');
  }

  await assertAccountBelongsToCompany(companyId, data.assetAccountId, 'cuenta del activo');
  await assertAccountBelongsToCompany(companyId, data.depreciationExpenseAccountId, 'gasto de depreciación');
  await assertAccountBelongsToCompany(companyId, data.accumulatedDepreciationAccountId, 'depreciación acumulada');

  const existing = await prisma.fixedAsset.findUnique({ where: { companyId_code: { companyId, code: data.code } } });
  if (existing) {
    throw new AppError(`Ya existe un activo fijo con el código "${data.code}".`, 409, 'FIXED_ASSET_CODE_EXISTS');
  }

  return prisma.$transaction(async (tx) => {
    const asset = await tx.fixedAsset.create({ data: { companyId, ...data } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fixed_asset.created',
        entityType: 'FixedAsset',
        entityId: asset.id,
        oldValue: null,
        newValue: asset,
      },
      tx
    );
    return asset;
  });
}

async function listFixedAssets(companyId, { status } = {}) {
  return prisma.fixedAsset.findMany({ where: { companyId, status: status || undefined }, orderBy: { code: 'asc' } });
}

async function getFixedAsset(companyId, id) {
  const asset = await prisma.fixedAsset.findFirst({ where: { id, companyId } });
  if (!asset) throw new AppError('El activo fijo indicado no existe.', 404, 'FIXED_ASSET_NOT_FOUND');
  return asset;
}

async function disposeAsset(companyId, id, userId, disposedAt) {
  const asset = await getFixedAsset(companyId, id);
  if (asset.status === 'DISPOSED') {
    throw new AppError('Este activo ya fue dado de baja.', 409, 'ALREADY_DISPOSED');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fixedAsset.update({
      where: { id },
      data: { status: 'DISPOSED', disposedAt: disposedAt || new Date() },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fixed_asset.disposed',
        entityType: 'FixedAsset',
        entityId: id,
        oldValue: { status: asset.status },
        newValue: { status: 'DISPOSED' },
      },
      tx
    );
    return updated;
  });
}

function sameMonth(a, b) {
  return a && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

// Corre la depreciación de un solo activo para el periodo de asOfDate y
// postea el asiento a través del motor de asientos del core. Devuelve
// null si no había nada que depreciar (ya se corrió este mes, ya está
// totalmente depreciado, o es por unidades y no se indicaron unidades).
async function depreciateAsset(companyId, asset, asOfDate, userId, unitsThisPeriod) {
  if (asset.status !== 'ACTIVE') return null;
  if (sameMonth(asset.lastDepreciationDate, asOfDate)) return null;
  if (asset.depreciationMethod === 'UNITS_OF_PRODUCTION' && !unitsThisPeriod) return null;

  const amount = calculateDepreciation(asset.depreciationMethod, {
    purchaseValue: asset.purchaseValue,
    salvageValue: asset.salvageValue,
    usefulLifeMonths: asset.usefulLifeMonths,
    totalUnitsOfProduction: asset.totalUnitsOfProduction,
    unitsThisPeriod,
    accumulatedDepreciation: asset.accumulatedDepreciation,
  });

  if (amount.isZero()) return null;

  const entry = await ledgerService.postEntry({
    companyId,
    date: asOfDate,
    description: `Depreciación de "${asset.name}" (${asset.code})`,
    lines: [
      { accountId: asset.depreciationExpenseAccountId, debit: amount.toNumber(), credit: 0 },
      { accountId: asset.accumulatedDepreciationAccountId, debit: 0, credit: amount.toNumber() },
    ],
    origin: 'AUTOMATIC',
    sourceModule: 'accounting-fixed-assets',
    sourceReference: asset.id,
    createdByUserId: userId,
    autoApprove: true,
  });

  const newAccumulated = asset.accumulatedDepreciation.plus(amount);
  const depreciableBase = asset.purchaseValue.minus(asset.salvageValue);
  const fullyDepreciated = newAccumulated.greaterThanOrEqualTo(depreciableBase);

  await prisma.fixedAsset.update({
    where: { id: asset.id },
    data: {
      accumulatedDepreciation: newAccumulated,
      lastDepreciationDate: asOfDate,
      status: fullyDepreciated ? 'FULLY_DEPRECIATED' : 'ACTIVE',
    },
  });

  return entry;
}

// Corre la depreciación mensual de todos los activos activos de una
// empresa. unitsByAssetId es opcional: { [fixedAssetId]: unidadesUsadasEsteMes }
// para los activos con método "por unidades de producción".
async function runMonthlyDepreciation(companyId, asOfDate, userId, unitsByAssetId = {}) {
  const assets = await prisma.fixedAsset.findMany({ where: { companyId, status: 'ACTIVE' } });
  const postedEntries = [];
  for (const asset of assets) {
    const entry = await depreciateAsset(companyId, asset, asOfDate, userId, unitsByAssetId[asset.id]);
    if (entry) postedEntries.push(entry);
  }
  return postedEntries;
}

module.exports = {
  createFixedAsset,
  listFixedAssets,
  getFixedAsset,
  disposeAsset,
  depreciateAsset,
  runMonthlyDepreciation,
};
