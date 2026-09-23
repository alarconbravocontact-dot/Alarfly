const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// Función pura: dado el saldo en moneda extranjera de una cuenta, el
// saldo actual en libros (moneda base) y la tasa más reciente, calcula
// cuánto debería valer el saldo hoy y la diferencia a ajustar
// (diferencial cambiario, positivo = ganancia, negativo = pérdida).
function calculateFxDifferential(foreignBalance, currentBaseBalance, currentRate) {
  const shouldBeBaseBalance = new Decimal(foreignBalance).times(currentRate);
  const differential = shouldBeBaseBalance.minus(currentBaseBalance);
  return { shouldBeBaseBalance, differential };
}

module.exports = { calculateFxDifferential };
