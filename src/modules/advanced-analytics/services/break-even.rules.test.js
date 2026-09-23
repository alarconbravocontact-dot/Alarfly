const { Prisma } = require('@prisma/client');
const { calculateBreakEven } = require('./break-even.rules');

const { Decimal } = Prisma;

describe('calculateBreakEven', () => {
  test('caso normal: calcula el punto de equilibrio en moneda', () => {
    // Ingresos 10000, costos variables 6000 (60%) → margen de
    // contribución 40%. Costos fijos 2000 → equilibrio = 2000/0.4 = 5000.
    const result = calculateBreakEven({ totalRevenue: 10000, fixedCosts: 2000, variableCosts: 6000 });
    expect(result.contributionMarginRatio.toString()).toBe('0.4');
    expect(result.breakEvenRevenue.toString()).toBe('5000');
    expect(result.isAchievable).toBe(true);
    expect(result.safetyMarginRevenue.toString()).toBe('5000');
    expect(result.safetyMarginPercent.toString()).toBe('50');
  });

  test('margen de contribución negativo → el equilibrio no es alcanzable', () => {
    const result = calculateBreakEven({ totalRevenue: 1000, fixedCosts: 500, variableCosts: 1200 });
    expect(result.isAchievable).toBe(false);
    expect(result.breakEvenRevenue).toBeNull();
    expect(result.safetyMarginRevenue).toBeNull();
  });

  test('margen de contribución exactamente cero → tampoco es alcanzable', () => {
    const result = calculateBreakEven({ totalRevenue: 1000, fixedCosts: 500, variableCosts: 1000 });
    expect(result.isAchievable).toBe(false);
  });

  test('rechaza calcular sin ingresos en el periodo', () => {
    expect(() => calculateBreakEven({ totalRevenue: 0, fixedCosts: 500, variableCosts: 100 })).toThrow('sin ingresos');
    expect(() => calculateBreakEven({ totalRevenue: -100, fixedCosts: 500, variableCosts: 100 })).toThrow('sin ingresos');
  });

  test('usa precisión decimal exacta, no float', () => {
    const result = calculateBreakEven({ totalRevenue: '333.33', fixedCosts: '100.10', variableCosts: '111.11' });
    expect(result.totalRevenue).toBeInstanceOf(Decimal);
    expect(result.breakEvenRevenue).toBeInstanceOf(Decimal);
  });
});
