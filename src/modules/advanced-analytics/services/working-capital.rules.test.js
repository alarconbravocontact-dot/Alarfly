const { Prisma } = require('@prisma/client');
const { calculateWorkingCapital, calculateCashConversionCycle } = require('./working-capital.rules');

const { Decimal } = Prisma;

describe('calculateWorkingCapital', () => {
  test('caso normal: capital de trabajo positivo', () => {
    const result = calculateWorkingCapital({ currentAssets: 15000, currentLiabilities: 9000 });
    expect(result.workingCapital.toString()).toBe('6000');
    expect(result.currentRatio.toString()).toBe(new Decimal(15000).dividedBy(9000).toString());
  });

  test('capital de trabajo negativo: los pasivos corrientes superan los activos corrientes', () => {
    const result = calculateWorkingCapital({ currentAssets: 5000, currentLiabilities: 8000 });
    expect(result.workingCapital.toString()).toBe('-3000');
  });

  test('sin pasivos corrientes → el ratio es null en vez de dividir entre cero', () => {
    const result = calculateWorkingCapital({ currentAssets: 5000, currentLiabilities: 0 });
    expect(result.currentRatio).toBeNull();
    expect(result.workingCapital.toString()).toBe('5000');
  });
});

describe('calculateCashConversionCycle', () => {
  test('caso normal: calcula DSO, DIO, DPO y el ciclo combinado', () => {
    // Números elegidos para que las fracciones terminen exacto en
    // decimal (denominadores con solo factores 2 y 5), y así el
    // resultado se pueda comparar con un string exacto:
    // DSO = 2000/20000*360 = 36 ; DIO = 5000/20000*360 = 90 ; DPO = 2500/20000*360 = 45
    // CCC = 36 + 90 - 45 = 81
    const result = calculateCashConversionCycle({
      averageReceivables: 2000,
      averageInventory: 5000,
      averagePayables: 2500,
      revenue: 20000,
      cogs: 20000,
      periodDays: 360,
    });
    expect(result.dso.toString()).toBe('36');
    expect(result.dio.toString()).toBe('90');
    expect(result.dpo.toString()).toBe('45');
    expect(result.cashConversionCycle.toString()).toBe('81');
  });

  test('un DPO alto (se paga tarde a proveedores) reduce el ciclo de conversión', () => {
    const base = { averageReceivables: 3000, averageInventory: 4000, revenue: 30000, cogs: 24000, periodDays: 360 };
    const lowDpo = calculateCashConversionCycle({ ...base, averagePayables: 500 });
    const highDpo = calculateCashConversionCycle({ ...base, averagePayables: 5000 });
    expect(highDpo.cashConversionCycle.lessThan(lowDpo.cashConversionCycle)).toBe(true);
  });

  test('rechaza calcular sin ingresos o sin costo de venta en el periodo', () => {
    const base = { averageReceivables: 100, averageInventory: 100, averagePayables: 100, periodDays: 30 };
    expect(() => calculateCashConversionCycle({ ...base, revenue: 0, cogs: 100 })).toThrow('sin ingresos');
    expect(() => calculateCashConversionCycle({ ...base, revenue: 100, cogs: 0 })).toThrow('sin costo de venta');
  });
});
