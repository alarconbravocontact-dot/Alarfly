const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// Función pura: "explota" una Lista de Materiales — dado cuánto se
// vendió del producto padre, calcula cuánto hay que descontar de cada
// componente. Un solo nivel (no explota BOM anidado todavía).
function explodeBomComponents(bomComponents, quantitySold) {
  const sold = new Decimal(quantitySold);
  return bomComponents.map((component) => ({
    componentVariantId: component.componentVariantId,
    quantityToConsume: new Decimal(component.quantity).times(sold),
  }));
}

module.exports = { explodeBomComponents };
