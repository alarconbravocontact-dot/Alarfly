const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { assertNoRateOverlap, findApplicableRate } = require('./tax-rates.rules');

async function assertGlAccountUsable(companyId, glAccountId) {
  if (!glAccountId) return;
  const account = await prisma.account.findFirst({ where: { id: glAccountId, companyId } });
  if (!account) {
    throw new AppError('La cuenta contable indicada no existe en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
  }
  if (!account.isPostable) {
    throw new AppError(`La cuenta "${account.name}" es agrupadora; no puede recibir movimientos.`, 400, 'ACCOUNT_NOT_POSTABLE');
  }
}

async function createJurisdiction(companyId, userId, data) {
  const existing = await prisma.taxJurisdiction.findUnique({
    where: { companyId_code: { companyId, code: data.code } },
  });
  if (existing) {
    throw new AppError(`Ya existe una jurisdicción con el código "${data.code}".`, 409, 'JURISDICTION_EXISTS');
  }

  return prisma.$transaction(async (tx) => {
    const jurisdiction = await tx.taxJurisdiction.create({ data: { companyId, code: data.code, name: data.name } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'tax_jurisdiction.created',
        entityType: 'TaxJurisdiction',
        entityId: jurisdiction.id,
        oldValue: null,
        newValue: jurisdiction,
      },
      tx
    );
    return jurisdiction;
  });
}

async function listJurisdictions(companyId) {
  return prisma.taxJurisdiction.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
}

async function createTaxRate(companyId, userId, data) {
  const jurisdiction = await prisma.taxJurisdiction.findFirst({ where: { id: data.jurisdictionId, companyId } });
  if (!jurisdiction) {
    throw new AppError('La jurisdicción indicada no existe en esta empresa.', 400, 'JURISDICTION_NOT_FOUND');
  }
  await assertGlAccountUsable(companyId, data.glAccountId);

  const appliesTo = data.appliesTo || 'BOTH';
  const siblingRates = await prisma.taxRate.findMany({
    where: { companyId, jurisdictionId: data.jurisdictionId, type: data.type, appliesTo, isActive: true },
  });
  assertNoRateOverlap(siblingRates, { validFrom: data.validFrom, validTo: data.validTo || null });

  return prisma.$transaction(async (tx) => {
    const rate = await tx.taxRate.create({
      data: {
        companyId,
        jurisdictionId: data.jurisdictionId,
        type: data.type,
        code: data.code,
        name: data.name,
        rate: data.rate,
        appliesTo,
        validFrom: data.validFrom,
        validTo: data.validTo || null,
        glAccountId: data.glAccountId || null,
      },
    });
    await auditService.log(
      { companyId, userId, action: 'tax_rate.created', entityType: 'TaxRate', entityId: rate.id, oldValue: null, newValue: rate },
      tx
    );
    return rate;
  });
}

// Cierra la vigencia de una tasa (nunca se edita el porcentaje de una
// tasa que ya se usó: se cierra con validTo y se crea una tasa nueva).
async function closeTaxRate(companyId, id, userId, validTo) {
  const rate = await prisma.taxRate.findFirst({ where: { id, companyId } });
  if (!rate) {
    throw new AppError('La tasa indicada no existe.', 404, 'TAX_RATE_NOT_FOUND');
  }
  if (rate.validTo) {
    throw new AppError('Esta tasa ya tiene fecha de cierre.', 409, 'TAX_RATE_ALREADY_CLOSED');
  }
  if (new Date(validTo) < rate.validFrom) {
    throw new AppError('La fecha de cierre no puede ser anterior a la fecha de inicio de la tasa.', 400, 'INVALID_VALID_TO');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.taxRate.update({ where: { id }, data: { validTo } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'tax_rate.closed',
        entityType: 'TaxRate',
        entityId: id,
        oldValue: { validTo: rate.validTo },
        newValue: { validTo },
      },
      tx
    );
    return updated;
  });
}

async function listTaxRates(companyId, { jurisdictionId, type, isActive } = {}) {
  return prisma.taxRate.findMany({
    where: {
      companyId,
      jurisdictionId: jurisdictionId || undefined,
      type: type || undefined,
      isActive: isActive === undefined ? undefined : isActive,
    },
    orderBy: [{ jurisdictionId: 'asc' }, { validFrom: 'desc' }],
  });
}

// Punto 1: dado emisor/receptor (representado por la jurisdicción),
// tipo de transacción y fecha, resuelve qué tasa de impuesto y de
// retención aplican. Cualquiera de las dos puede no existir (una
// empresa que no maneja retenciones, por ejemplo) — eso no es un
// error, simplemente no hay retención que aplicar.
async function resolveApplicableTax(companyId, { jurisdictionId, transactionType, date }) {
  const candidateRates = await prisma.taxRate.findMany({
    where: { companyId, jurisdictionId, isActive: true, appliesTo: { in: [transactionType, 'BOTH'] } },
  });

  const asOfDate = new Date(date);
  const taxRate = findApplicableRate(
    candidateRates.filter((rate) => rate.type === 'VAT'),
    asOfDate
  );
  const withholdingRate = findApplicableRate(
    candidateRates.filter((rate) => rate.type === 'WITHHOLDING'),
    asOfDate
  );

  return { taxRate, withholdingRate };
}

module.exports = {
  assertGlAccountUsable,
  createJurisdiction,
  listJurisdictions,
  createTaxRate,
  closeTaxRate,
  listTaxRates,
  resolveApplicableTax,
};
