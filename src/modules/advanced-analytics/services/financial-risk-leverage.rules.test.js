const { Prisma } = require('@prisma/client');
const {
  calculateOperatingLeverage,
  calculateFinancialLeverage,
  calculateCombinedLeverage,
  calculateFxExposureRatio,
} = require('./financial-risk-leverage.rules');

const { Decimal } = Prisma;

describe('calculateOperatingLeverage', () => {
  test('caso normal', () => {
    const dol = calculateOperatingLeverage({ contributionMargin: 4000, operatingIncome: 2000 });
    expect(dol.toString()).toBe('2');
  });

  test('rechaza con utilidad operativa en cero', () => {
    expect(() => calculateOperatingLeverage({ contributionMargin: 4000, operatingIncome: 0 })).toThrow('utilidad operativa en cero');
  });
});

describe('calculateFinancialLeverage', () => {
  test('caso normal', () => {
    const dfl = calculateFinancialLeverage({ operatingIncome: 2000, interestExpense: 500 });
    expect(dfl.toString()).toBe(new Decimal(2000).dividedBy(1500).toString());
  });

  test('rechaza cuando la utilidad operativa apenas cubre los intereses', () => {
    expect(() => calculateFinancialLeverage({ operatingIncome: 2000, interestExpense: 2000 })).toThrow('apenas cubre los intereses');
  });
});

describe('calculateCombinedLeverage', () => {
  test('es el producto de los dos apalancamientos', () => {
    const combined = calculateCombinedLeverage({ operatingLeverage: 2, financialLeverage: 1.5 });
    expect(combined.toString()).toBe('3');
  });
});

describe('calculateFxExposureRatio', () => {
  test('caso normal', () => {
    const ratio = calculateFxExposureRatio({ foreignCurrencyBalance: 2500, totalAssets: 10000 });
    expect(ratio.toString()).toBe('25');
  });

  test('sin activos totales, la exposición es 0 en vez de dividir entre cero', () => {
    const ratio = calculateFxExposureRatio({ foreignCurrencyBalance: 500, totalAssets: 0 });
    expect(ratio.toString()).toBe('0');
  });
});
