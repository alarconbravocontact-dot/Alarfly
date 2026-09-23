const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// Función pura: dado el ingreso/costo directo de cada dimensión
// (Producto o Cliente, ya sumado desde las líneas de asiento
// etiquetadas) y el total de costo indirecto de la empresa en el
// periodo (gastos NO etiquetados a ningún Producto/Cliente), reparte
// ese costo indirecto a prorrata de la participación de cada
// dimensión en el ingreso directo total — simplificación consciente
// (no es costeo ABC), aprobada explícitamente por el usuario como
// "opción simple de % de costo indirecto".
function allocateIndirectCosts(dimensionRows, totalIndirectCost) {
  const totalDirectRevenue = dimensionRows.reduce((sum, row) => sum.plus(row.directRevenue), new Decimal(0));
  const indirectCost = new Decimal(totalIndirectCost);

  return dimensionRows.map((row) => {
    const directRevenue = new Decimal(row.directRevenue);
    const directCost = new Decimal(row.directCost);
    const revenueShare = totalDirectRevenue.isZero() ? new Decimal(0) : directRevenue.div(totalDirectRevenue);
    const indirectCostAllocated = indirectCost.times(revenueShare);

    const contributionMargin = directRevenue.minus(directCost);
    const netMargin = contributionMargin.minus(indirectCostAllocated);

    return {
      dimensionId: row.dimensionId,
      dimensionName: row.dimensionName,
      directRevenue: directRevenue.toFixed(2),
      directCost: directCost.toFixed(2),
      contributionMargin: contributionMargin.toFixed(2),
      contributionMarginPercent: directRevenue.isZero() ? null : contributionMargin.div(directRevenue).times(100).toFixed(2),
      indirectCostAllocated: indirectCostAllocated.toFixed(2),
      netMargin: netMargin.toFixed(2),
      netMarginPercent: directRevenue.isZero() ? null : netMargin.div(directRevenue).times(100).toFixed(2),
    };
  });
}

function rankByNetMargin(allocatedRows) {
  const sorted = [...allocatedRows].sort((a, b) => Number(b.netMargin) - Number(a.netMargin));
  return {
    mostProfitable: sorted.slice(0, 5),
    leastProfitable: sorted.slice(-5).reverse(),
  };
}

module.exports = { allocateIndirectCosts, rankByNetMargin };
