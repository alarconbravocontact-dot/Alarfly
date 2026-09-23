const { calculateFinancialRatios, safeDivide } = require('./financial-ratios.rules');

describe('safeDivide', () => {
  test('divide normalmente', () => {
    expect(safeDivide(10, 4).toString()).toBe('2.5');
  });

  test('devuelve null en vez de lanzar error con denominador cero', () => {
    expect(safeDivide(10, 0)).toBeNull();
  });
});

describe('calculateFinancialRatios', () => {
  const inputs = {
    currentAssets: 15000,
    currentLiabilities: 5000,
    inventory: 4000,
    totalAssets: 40000,
    totalLiabilities: 15000,
    totalEquity: 25000,
    netIncome: 5000,
    revenue: 50000,
    cogs: 30000,
    averageInventory: 6000,
  };

  test('calcula los 5 grupos de ratios', () => {
    const result = calculateFinancialRatios(inputs);
    expect(result.liquidity.currentRatio.toString()).toBe('3');
    expect(result.liquidity.quickRatio.toString()).toBe('2.2');
    expect(result.solvency.debtRatio.toString()).toBe('0.375');
    expect(result.solvency.debtToEquityRatio.toString()).toBe('0.6');
    expect(result.profitability.netMargin.toString()).toBe('0.1');
    expect(result.profitability.returnOnAssets.toString()).toBe('0.125');
    expect(result.profitability.returnOnEquity.toString()).toBe('0.2');
    expect(result.activity.assetTurnover.toString()).toBe('1.25');
    expect(result.activity.inventoryTurnover.toString()).toBe('5');
    expect(result.valuation.bookValue.toString()).toBe('25000');
  });

  test('un denominador en cero deja ese ratio en null sin afectar a los demás', () => {
    const result = calculateFinancialRatios({ ...inputs, currentLiabilities: 0 });
    expect(result.liquidity.currentRatio).toBeNull();
    expect(result.liquidity.quickRatio).toBeNull();
    expect(result.solvency.debtRatio.toString()).toBe('0.375');
  });
});
