// Rentabilidad por Producto/Cliente (punto 4). Reutiliza la jerarquía
// de FpaDimension (tipos PRODUCT/CLIENT, agregados al enum para este
// punto) y la tabla puente JournalEntryLineFpaDimension que ya existía
// para etiquetar líneas de asiento — no se crea ningún catálogo nuevo
// de productos o clientes.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const { allocateIndirectCosts, rankByNetMargin } = require('./profitability.rules');

const { Decimal } = Prisma;

async function getProfitabilityByDimensionType(companyId, type, { from, to }) {
  const dimensions = await prisma.fpaDimension.findMany({ where: { companyId, type, isActive: true } });

  const tags = await prisma.journalEntryLineFpaDimension.findMany({
    where: {
      fpaDimension: { companyId, type },
      line: { journalEntry: { companyId, status: 'APPROVED', date: { gt: from, lte: to } } },
    },
    include: { line: { include: { account: true } } },
  });

  const taggedLineIds = new Set(tags.map((t) => t.lineId));

  const byDimension = new Map(dimensions.map((d) => [d.id, { dimensionId: d.id, dimensionName: d.name, directRevenue: new Decimal(0), directCost: new Decimal(0) }]));

  for (const tag of tags) {
    const row = byDimension.get(tag.fpaDimensionId);
    if (!row) continue;
    const debit = new Decimal(tag.line.debit);
    const credit = new Decimal(tag.line.credit);
    if (tag.line.account.type === 'INCOME') {
      row.directRevenue = row.directRevenue.plus(credit.minus(debit));
    } else if (tag.line.account.type === 'EXPENSE') {
      row.directCost = row.directCost.plus(debit.minus(credit));
    }
  }

  // Costo indirecto de la empresa en el periodo: gasto real que NO
  // quedó etiquetado a ninguna dimensión de este tipo — es lo que se
  // reparte a prorrata (ver profitability.rules.allocateIndirectCosts).
  const allExpenseLines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: { companyId, status: 'APPROVED', date: { gt: from, lte: to } },
      account: { companyId, type: 'EXPENSE' },
    },
  });

  let totalIndirectCost = new Decimal(0);
  for (const line of allExpenseLines) {
    if (taggedLineIds.has(line.id)) continue;
    totalIndirectCost = totalIndirectCost.plus(new Decimal(line.debit).minus(line.credit));
  }

  const rows = [...byDimension.values()];
  const allocated = allocateIndirectCosts(rows, totalIndirectCost);
  const ranking = rankByNetMargin(allocated);

  return {
    from,
    to,
    totalIndirectCost: totalIndirectCost.toFixed(2),
    rows: allocated,
    ...ranking,
  };
}

async function getProductProfitability(companyId, range) {
  return getProfitabilityByDimensionType(companyId, 'PRODUCT', range);
}

async function getClientProfitability(companyId, range) {
  return getProfitabilityByDimensionType(companyId, 'CLIENT', range);
}

module.exports = { getProductProfitability, getClientProfitability };
