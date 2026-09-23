const { Prisma } = require('@prisma/client');
const { calculateDupont } = require('./dupont.rules');

const { Decimal } = Prisma;

describe('calculateDupont', () => {
  test('el ROE es el producto exacto de los 3 factores', () => {
    const result = calculateDupont({ netIncome: 1000, revenue: 10000, totalAssets: 20000, totalEquity: 8000 });
    const productOfFactors = result.netProfitMargin.times(result.assetTurnover).times(result.equityMultiplier);
    expect(result.roe.toString()).toBe(productOfFactors.toString());
  });

  test('el ROE coincide con la identidad simple Utilidad Neta / Patrimonio', () => {
    const result = calculateDupont({ netIncome: 1000, revenue: 10000, totalAssets: 20000, totalEquity: 8000 });
    const simpleRoe = new Decimal(1000).dividedBy(8000);
    // Redondeo de precisión: comparar con tolerancia mínima por la
    // división intermedia de los 3 factores.
    expect(result.roe.toDecimalPlaces(10).toString()).toBe(simpleRoe.toDecimalPlaces(10).toString());
  });

  test('calcula correctamente cada factor por separado', () => {
    const result = calculateDupont({ netIncome: 1000, revenue: 10000, totalAssets: 20000, totalEquity: 8000 });
    expect(result.netProfitMargin.toString()).toBe('0.1');
    expect(result.assetTurnover.toString()).toBe('0.5');
    expect(result.equityMultiplier.toString()).toBe('2.5');
  });

  test('rechaza sin ingresos, sin activos o con patrimonio en cero/negativo', () => {
    const base = { netIncome: 100, revenue: 1000, totalAssets: 2000, totalEquity: 500 };
    expect(() => calculateDupont({ ...base, revenue: 0 })).toThrow('sin ingresos');
    expect(() => calculateDupont({ ...base, totalAssets: 0 })).toThrow('sin activos');
    expect(() => calculateDupont({ ...base, totalEquity: 0 })).toThrow('patrimonio');
    expect(() => calculateDupont({ ...base, totalEquity: -500 })).toThrow('patrimonio');
  });
});
