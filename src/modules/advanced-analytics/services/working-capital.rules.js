const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: Capital de Trabajo en moneda (no solo el ratio simple
// que ya calcula Razones Financieras) — cuánto le queda a la empresa
// de "colchón" entre lo que puede volverse efectivo pronto y lo que
// tiene que pagar pronto.
function calculateWorkingCapital({ currentAssets, currentLiabilities }) {
  const assets = new Decimal(currentAssets);
  const liabilities = new Decimal(currentLiabilities);
  const workingCapital = assets.minus(liabilities);
  const currentRatio = liabilities.isZero() ? null : assets.dividedBy(liabilities);
  return { currentAssets: assets, currentLiabilities: liabilities, workingCapital, currentRatio };
}

// Función pura: Ciclo de Conversión de Efectivo (CCC) = días que se
// demora en promedio el dinero en volver a ser efectivo. Usa saldos
// promedio de Cuentas por Cobrar (AR), Inventario y Cuentas por Pagar
// (AP) — datos que ya existen en esos módulos, acá solo se combinan.
//   DSO (días de cobro)  = CuentasPorCobrar / Ingresos      × días del periodo
//   DIO (días de inventario) = Inventario / CostoDeVenta    × días del periodo
//   DPO (días de pago)   = CuentasPorPagar / CostoDeVenta   × días del periodo
//   CCC = DSO + DIO - DPO
function calculateCashConversionCycle({ averageReceivables, averageInventory, averagePayables, revenue, cogs, periodDays }) {
  const rev = new Decimal(revenue);
  const cost = new Decimal(cogs);
  if (rev.lessThanOrEqualTo(0)) {
    throw new AppError('No se puede calcular el ciclo de conversión de efectivo sin ingresos en el periodo.', 400, 'NO_REVENUE');
  }
  if (cost.lessThanOrEqualTo(0)) {
    throw new AppError('No se puede calcular el ciclo de conversión de efectivo sin costo de venta en el periodo.', 400, 'NO_COGS');
  }

  const days = new Decimal(periodDays);
  const dso = new Decimal(averageReceivables).dividedBy(rev).times(days);
  const dio = new Decimal(averageInventory).dividedBy(cost).times(days);
  const dpo = new Decimal(averagePayables).dividedBy(cost).times(days);
  const cashConversionCycle = dso.plus(dio).minus(dpo);

  return { dso, dio, dpo, cashConversionCycle };
}

module.exports = { calculateWorkingCapital, calculateCashConversionCycle };
