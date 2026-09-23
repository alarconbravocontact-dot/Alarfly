const {
  calculateStraightLine,
  calculateDecliningBalance,
  calculateUnitsOfProduction,
  calculateDepreciation,
} = require('./depreciation.rules');
const AppError = require('../../../core/utils/AppError');

describe('calculateStraightLine (depreciación lineal)', () => {
  test('calcula el monto mensual constante', () => {
    // Compra 12,000, valor residual 0, vida útil 24 meses -> 500/mes.
    const amount = calculateStraightLine({
      purchaseValue: 12000,
      salvageValue: 0,
      usefulLifeMonths: 24,
      accumulatedDepreciation: 0,
    });
    expect(amount.toFixed(2)).toBe('500.00');
  });

  test('no deprecia más allá del valor depreciable restante', () => {
    const amount = calculateStraightLine({
      purchaseValue: 12000,
      salvageValue: 2000,
      usefulLifeMonths: 10,
      accumulatedDepreciation: 9500, // solo quedan 500 por depreciar
    });
    expect(amount.toFixed(2)).toBe('500.00');
  });

  test('devuelve cero si ya está totalmente depreciado', () => {
    const amount = calculateStraightLine({
      purchaseValue: 12000,
      salvageValue: 2000,
      usefulLifeMonths: 10,
      accumulatedDepreciation: 10000,
    });
    expect(amount.isZero()).toBe(true);
  });
});

describe('calculateDecliningBalance (depreciación acelerada)', () => {
  test('el primer periodo deprecia más que un periodo posterior', () => {
    const params = { purchaseValue: 12000, salvageValue: 1000, usefulLifeMonths: 24 };
    const first = calculateDecliningBalance({ ...params, accumulatedDepreciation: 0 });
    const later = calculateDecliningBalance({ ...params, accumulatedDepreciation: 6000 });
    expect(first.greaterThan(later)).toBe(true);
  });

  test('nunca deprecia por debajo del valor residual', () => {
    // Con accumulatedDepreciation=10950, solo quedan 50 por depreciar
    // (12000 - 1000 - 10950), aunque la fórmula normal daría más.
    const amount = calculateDecliningBalance({
      purchaseValue: 12000,
      salvageValue: 1000,
      usefulLifeMonths: 24,
      accumulatedDepreciation: 10950,
    });
    expect(amount.toFixed(2)).toBe('50.00');
  });
});

describe('calculateUnitsOfProduction (depreciación por unidades)', () => {
  test('calcula proporcional a las unidades usadas en el periodo', () => {
    // 50,000 depreciables / 100,000 km totales = 0.5 por km.
    const amount = calculateUnitsOfProduction({
      purchaseValue: 55000,
      salvageValue: 5000,
      totalUnitsOfProduction: 100000,
      unitsThisPeriod: 2000,
      accumulatedDepreciation: 0,
    });
    expect(amount.toFixed(2)).toBe('1000.00');
  });

  test('exige totalUnitsOfProduction', () => {
    expect(() =>
      calculateUnitsOfProduction({
        purchaseValue: 55000,
        salvageValue: 5000,
        totalUnitsOfProduction: null,
        unitsThisPeriod: 2000,
        accumulatedDepreciation: 0,
      })
    ).toThrow(AppError);
  });
});

describe('calculateDepreciation (dispatcher)', () => {
  test('rechaza un método desconocido', () => {
    expect(() => calculateDepreciation('OTRO', {})).toThrow(/desconocido/);
  });
});
