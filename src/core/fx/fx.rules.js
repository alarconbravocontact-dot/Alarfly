const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');

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

// Fase 6 (secciones 6/9/32): hace explícito un supuesto que ya estaba
// implícito en todo el proyecto (AR, AP, Órdenes de Pago, Deuda) desde
// antes de esta fase — `JournalEntryLine.debit/credit` siempre están en
// moneda base (ver el comentario del propio modelo) y
// `TreasuryAccount.currentBalance` siempre está en `TreasuryAccount.currency`
// (así lo asume `getConsolidatedCashPosition`, que convierte explícitamente
// al consolidar). Un mismo monto sin conversión solo puede cumplir las
// dos cosas a la vez si la cuenta de tesorería usada para liquidar
// (cobro/pago directo, orden de pago, deuda) está en la moneda base de
// la empresa — nunca se validaba esto, así que elegir una cuenta en
// otra moneda ahí corrompía el saldo en silencio. Esta función solo lo
// vuelve un error claro en vez de un número mal calculado; no agrega
// ninguna conversión nueva. Una cuenta en otra moneda sigue siendo
// completamente válida para todo lo demás (verla en Dinero/Tesorería,
// recibir el snapshot foreignCurrency/foreignAmount/exchangeRate de un
// cobro/pago de AR/AP) — documentado como límite consciente: liquidar
// una Orden de Pago o una Deuda en una moneda distinta a la base queda
// para una fase futura si se necesita de verdad (mismo criterio que ya
// usa este proyecto para "no inventar" transferencias multimoneda).
function assertBaseCurrencySettlement(baseCurrency, treasuryAccount, context) {
  if (treasuryAccount.currency === baseCurrency) return;
  throw new AppError(
    `La cuenta de tesorería "${treasuryAccount.name}" está en ${treasuryAccount.currency}, pero ${context} necesita liquidarse en la moneda base de la empresa (${baseCurrency}). Elige una cuenta en ${baseCurrency}.`,
    400,
    'SETTLEMENT_CURRENCY_MISMATCH'
  );
}

module.exports = { calculateFxDifferential, assertBaseCurrencySettlement };
