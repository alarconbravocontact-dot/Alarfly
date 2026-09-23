const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: Grado de Apalancamiento Operativo (DOL) — qué tan
// sensible es la utilidad operativa a un cambio en las ventas. Un DOL
// alto significa que buena parte de los costos son fijos: un cambio
// pequeño en ventas mueve mucho la utilidad, para bien o para mal.
function calculateOperatingLeverage({ contributionMargin, operatingIncome }) {
  const margin = new Decimal(contributionMargin);
  const income = new Decimal(operatingIncome);
  if (income.isZero()) {
    throw new AppError('No se puede calcular el apalancamiento operativo con utilidad operativa en cero.', 400, 'ZERO_OPERATING_INCOME');
  }
  return margin.dividedBy(income);
}

// Función pura: Grado de Apalancamiento Financiero (DFL) — qué tan
// sensible es la utilidad neta a los intereses de la deuda. Un DFL
// alto significa que la empresa depende mucho de deuda cara.
function calculateFinancialLeverage({ operatingIncome, interestExpense }) {
  const income = new Decimal(operatingIncome);
  const interest = new Decimal(interestExpense);
  const denominator = income.minus(interest);
  if (denominator.isZero()) {
    throw new AppError(
      'No se puede calcular el apalancamiento financiero: la utilidad operativa apenas cubre los intereses.',
      400,
      'ZERO_LEVERAGE_DENOMINATOR'
    );
  }
  return income.dividedBy(denominator);
}

// Función pura: Apalancamiento Combinado = DOL × DFL — la sensibilidad
// total de la utilidad neta ante un cambio en ventas, sumando el
// efecto operativo y el efecto financiero.
function calculateCombinedLeverage({ operatingLeverage, financialLeverage }) {
  return new Decimal(operatingLeverage).times(financialLeverage);
}

// Función pura: qué porcentaje de los activos totales está denominado
// en moneda extranjera — reutiliza la marca `Account.isForeignCurrency`
// que ya existe en core/fx, no inventa un dato nuevo.
function calculateFxExposureRatio({ foreignCurrencyBalance, totalAssets }) {
  const assets = new Decimal(totalAssets);
  if (assets.isZero()) {
    return new Decimal(0);
  }
  return new Decimal(foreignCurrencyBalance).dividedBy(assets).times(100);
}

module.exports = {
  calculateOperatingLeverage,
  calculateFinancialLeverage,
  calculateCombinedLeverage,
  calculateFxExposureRatio,
};
