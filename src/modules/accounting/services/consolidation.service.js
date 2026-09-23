const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const reportsService = require('./reports.service');

const { Decimal } = Prisma;

// Marca `companyId` como subsidiaria de `parentCompanyId` (o la separa
// del grupo si se manda null). Evita ciclos simples (una empresa no
// puede ser su propia ancestro).
async function setParentCompany(companyId, parentCompanyId, userId) {
  if (parentCompanyId === companyId) {
    throw new AppError('Una empresa no puede ser subsidiaria de sí misma.', 400, 'INVALID_PARENT_COMPANY');
  }

  if (parentCompanyId) {
    const parent = await prisma.company.findUnique({ where: { id: parentCompanyId } });
    if (!parent) {
      throw new AppError('La empresa matriz indicada no existe.', 404, 'COMPANY_NOT_FOUND');
    }

    let ancestor = parent;
    while (ancestor?.parentCompanyId) {
      if (ancestor.parentCompanyId === companyId) {
        throw new AppError('Esa relación crearía un ciclo entre empresas del grupo.', 400, 'CIRCULAR_COMPANY_GROUP');
      }
      ancestor = await prisma.company.findUnique({ where: { id: ancestor.parentCompanyId } });
    }
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({ where: { id: companyId }, data: { parentCompanyId } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'company.parent_company_changed',
        entityType: 'Company',
        entityId: companyId,
        oldValue: { parentCompanyId: company.parentCompanyId },
        newValue: { parentCompanyId },
      },
      tx
    );
    return updated;
  });
}

// Suma el balance de comprobación de una empresa matriz y sus
// subsidiarias directas, código de cuenta por código de cuenta, y
// excluye automáticamente las cuentas marcadas como inter-compañía
// (para no duplicar un saldo que ya está contado en la otra empresa).
// Simplificación consciente: asume que las empresas del grupo comparten
// la misma estructura de códigos de cuenta (ej: aplicaron la misma
// plantilla de plan de cuentas).
async function getConsolidatedTrialBalance(parentCompanyId, asOfDate) {
  const parent = await prisma.company.findUnique({ where: { id: parentCompanyId } });
  if (!parent) {
    throw new AppError('La empresa matriz indicada no existe.', 404, 'COMPANY_NOT_FOUND');
  }

  const subsidiaries = await prisma.company.findMany({ where: { parentCompanyId } });
  const companies = [parent, ...subsidiaries];

  const combined = new Map();
  let intercompanyEliminated = new Decimal(0);
  const eliminatedDetail = [];

  for (const company of companies) {
    const [report, accounts] = await Promise.all([
      reportsService.getTrialBalance(company.id, asOfDate),
      prisma.account.findMany({ where: { companyId: company.id }, select: { id: true, isIntercompany: true } }),
    ]);
    const isIntercompanyById = new Map(accounts.map((a) => [a.id, a.isIntercompany]));

    for (const row of report.rows) {
      if (isIntercompanyById.get(row.accountId)) {
        intercompanyEliminated = intercompanyEliminated.plus(row.balance);
        eliminatedDetail.push({ companyId: company.id, companyName: company.name, code: row.code, name: row.name, balance: row.balance });
        continue;
      }
      const existing = combined.get(row.code) || { code: row.code, name: row.name, balance: new Decimal(0) };
      existing.balance = existing.balance.plus(row.balance);
      combined.set(row.code, existing);
    }
  }

  const rows = [...combined.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((row) => ({ code: row.code, name: row.name, balance: row.balance.toFixed(2) }));

  return {
    parentCompany: { id: parent.id, name: parent.name },
    companiesIncluded: companies.map((company) => ({ id: company.id, name: company.name })),
    asOfDate,
    rows,
    intercompanyEliminated: intercompanyEliminated.toFixed(2),
    // Detalle línea por línea de qué cuenta de qué empresa se excluyó
    // (además del total ya existente en `intercompanyEliminated`) —
    // agregado para el punto 5 de Reportes, que necesita mostrar el
    // detalle de eliminaciones, no solo el total.
    eliminatedDetail: eliminatedDetail.sort((a, b) => a.code.localeCompare(b.code)),
  };
}

module.exports = { getConsolidatedTrialBalance, setParentCompany };
