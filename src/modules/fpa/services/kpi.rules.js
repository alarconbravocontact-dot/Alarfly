const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: EBITDA = Utilidad Neta + Intereses + Depreciación y
// Amortización. No se suma "Impuestos" porque el módulo Fiscal todavía
// no existe (limitación consciente, igual que otros puntos bloqueados
// por módulos futuros).
function calculateEbitda({ netIncome, interestExpense, depreciationAndAmortization }) {
  return new Decimal(netIncome).plus(interestExpense).plus(depreciationAndAmortization);
}

// Función pura: Burn Rate mensual = promedio mensual de pérdida neta.
// Si el resultado neto del periodo es positivo o cero, la empresa no
// está "quemando" caja: el burn rate es 0.
function calculateBurnRate({ netIncome, months }) {
  if (!months || months < 1) {
    throw new AppError('El periodo debe cubrir al menos un mes para calcular el Burn Rate.', 400, 'INVALID_PERIOD');
  }
  const netIncomeDecimal = new Decimal(netIncome);
  if (netIncomeDecimal.greaterThanOrEqualTo(0)) {
    return new Decimal(0);
  }
  return netIncomeDecimal.abs().dividedBy(months);
}

// Función pura: Runway = colchón de liquidez / burn rate mensual. Si no
// se está quemando caja (burn rate <= 0), el runway "no aplica"
// (se devuelve null en vez de una división por cero o un infinito).
function calculateRunway({ liquidityCushion, monthlyBurnRate }) {
  const burn = new Decimal(monthlyBurnRate);
  if (burn.lessThanOrEqualTo(0)) {
    return null;
  }
  return new Decimal(liquidityCushion).dividedBy(burn).toDecimalPlaces(1);
}

module.exports = { calculateEbitda, calculateBurnRate, calculateRunway };
