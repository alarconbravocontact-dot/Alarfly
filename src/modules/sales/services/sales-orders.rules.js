// Funciones puras del ciclo comercial de Ventas — igual criterio que el
// resto del proyecto: nada de acceso a base de datos acá, solo cálculo
// y decisiones de estado, para poder probarlas sin mocks pesados.
const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

function calculateLineAmount(quantity, unitPrice, discount = 0) {
  const qty = new Decimal(quantity);
  const price = new Decimal(unitPrice);
  const disc = new Decimal(discount || 0);
  return qty.times(price).minus(disc);
}

// Estado COMERCIAL del pedido (punto 9) — se deriva de qué tanto de
// cada línea física ya se entregó, nunca del estado financiero de
// ninguna factura. Una línea de servicio (sin `warehouseId`/reserva)
// se considera "entregada" apenas se confirma el pedido, porque un
// servicio no tiene un hecho físico posterior que esperar.
function determineOrderStatus(lines) {
  if (lines.length === 0) return 'CONFIRMED';

  const allDelivered = lines.every((line) => new Decimal(line.deliveredQuantity).greaterThanOrEqualTo(line.quantity));
  if (allDelivered) return 'DELIVERED';

  const anyDelivered = lines.some((line) => new Decimal(line.deliveredQuantity).greaterThan(0));
  return anyDelivered ? 'PARTIALLY_DELIVERED' : 'CONFIRMED';
}

// Cuánto de una línea sigue pendiente de entregar (punto 18: 1 pedido
// puede tener N entregas) — nunca negativo aunque se sobre-entregue por
// error de redondeo.
function remainingToDeliver(line) {
  const remaining = new Decimal(line.quantity).minus(line.deliveredQuantity);
  return remaining.isNegative() ? new Decimal(0) : remaining;
}

// Cuánto de lo YA entregado sigue sin facturar (punto 18: N entregas,
// N facturas, no necesariamente 1 a 1).
function remainingToInvoice(line) {
  const remaining = new Decimal(line.deliveredQuantity).minus(line.invoicedQuantity);
  return remaining.isNegative() ? new Decimal(0) : remaining;
}

// Costo promedio real de lo entregado hasta ahora para una línea —
// nunca un cálculo nuevo: `deliveredCostTotal` es la suma exacta de lo
// que ya devolvió el motor de valoración en cada entrega confirmada.
// Se usa para asignarle costo a la porción que se factura ahora.
function averageDeliveredUnitCost(line) {
  const deliveredQty = new Decimal(line.deliveredQuantity);
  if (deliveredQty.isZero()) return new Decimal(0);
  return new Decimal(line.deliveredCostTotal).dividedBy(deliveredQty);
}

module.exports = {
  calculateLineAmount,
  determineOrderStatus,
  remainingToDeliver,
  remainingToInvoice,
  averageDeliveredUnitCost,
};
