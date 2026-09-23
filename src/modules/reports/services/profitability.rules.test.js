const { allocateIndirectCosts, rankByNetMargin } = require('./profitability.rules');

describe('allocateIndirectCosts', () => {
  test('reparte el costo indirecto a prorrata de la participación en el ingreso directo', () => {
    const rows = [
      { dimensionId: 'p1', dimensionName: 'Producto A', directRevenue: 800, directCost: 300 },
      { dimensionId: 'p2', dimensionName: 'Producto B', directRevenue: 200, directCost: 50 },
    ];
    const result = allocateIndirectCosts(rows, 100);

    expect(result[0].indirectCostAllocated).toBe('80.00'); // 800/1000 * 100
    expect(result[1].indirectCostAllocated).toBe('20.00'); // 200/1000 * 100
    expect(result[0].contributionMargin).toBe('500.00');
    expect(result[0].netMargin).toBe('420.00');
  });

  test('no revienta cuando una dimensión no tiene ingreso directo (evita división entre cero)', () => {
    const rows = [{ dimensionId: 'p1', dimensionName: 'Producto sin ventas', directRevenue: 0, directCost: 50 }];
    const result = allocateIndirectCosts(rows, 100);

    expect(result[0].indirectCostAllocated).toBe('0.00');
    expect(result[0].contributionMarginPercent).toBeNull();
    expect(result[0].netMarginPercent).toBeNull();
  });

  test('no reparte nada si el total de costo indirecto es cero', () => {
    const rows = [{ dimensionId: 'p1', dimensionName: 'Producto A', directRevenue: 500, directCost: 100 }];
    const result = allocateIndirectCosts(rows, 0);
    expect(result[0].indirectCostAllocated).toBe('0.00');
    expect(result[0].netMargin).toBe('400.00');
  });
});

describe('rankByNetMargin', () => {
  test('ordena de mayor a menor margen neto y separa los 5 mejores y los 5 peores', () => {
    const rows = [
      { dimensionId: '1', netMargin: '100.00' },
      { dimensionId: '2', netMargin: '-50.00' },
      { dimensionId: '3', netMargin: '300.00' },
      { dimensionId: '4', netMargin: '-10.00' },
    ];
    const { mostProfitable, leastProfitable } = rankByNetMargin(rows);
    expect(mostProfitable[0].dimensionId).toBe('3');
    expect(mostProfitable[1].dimensionId).toBe('1');
    expect(leastProfitable[0].dimensionId).toBe('2');
  });
});
