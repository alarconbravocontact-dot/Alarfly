const { consumeCostLayers, calculateWeightedAverageCost, calculateAvailableStock } = require('./valuation.rules');

describe('consumeCostLayers (FIFO)', () => {
  const layers = [
    { id: 'l1', entryDate: '2026-07-01', unitCost: 10, remainingQuantity: 5 },
    { id: 'l2', entryDate: '2026-07-05', unitCost: 12, remainingQuantity: 5 },
  ];

  test('consume primero la capa más antigua', () => {
    const result = consumeCostLayers(layers, 3, 'FIFO');
    expect(result.consumptions).toHaveLength(1);
    expect(result.consumptions[0].layerId).toBe('l1');
    expect(result.totalCost.toFixed(2)).toBe('30.00');
    expect(result.averageUnitCost.toFixed(2)).toBe('10.00');
  });

  test('cuando una capa no alcanza, sigue con la siguiente en orden FIFO', () => {
    const result = consumeCostLayers(layers, 7, 'FIFO');
    expect(result.consumptions).toHaveLength(2);
    expect(result.consumptions[0]).toMatchObject({ layerId: 'l1' });
    expect(result.consumptions[1]).toMatchObject({ layerId: 'l2' });
    // 5*10 + 2*12 = 74, / 7 = 10.5714...
    expect(result.totalCost.toFixed(2)).toBe('74.00');
  });

  test('rechaza si no hay stock suficiente en las capas', () => {
    expect(() => consumeCostLayers(layers, 20, 'FIFO')).toThrow('No hay suficiente stock');
  });
});

describe('consumeCostLayers (LIFO)', () => {
  const layers = [
    { id: 'l1', entryDate: '2026-07-01', unitCost: 10, remainingQuantity: 5 },
    { id: 'l2', entryDate: '2026-07-05', unitCost: 12, remainingQuantity: 5 },
  ];

  test('consume primero la capa más reciente', () => {
    const result = consumeCostLayers(layers, 3, 'LIFO');
    expect(result.consumptions[0].layerId).toBe('l2');
    expect(result.totalCost.toFixed(2)).toBe('36.00');
  });
});

describe('calculateWeightedAverageCost', () => {
  test('promedia el costo ponderado por cantidad', () => {
    // 10 unidades a 5.00 + 10 unidades a 7.00 = 20 unidades a 6.00
    const result = calculateWeightedAverageCost(10, 5, 10, 7);
    expect(result.toFixed(2)).toBe('6.00');
  });

  test('si no había stock antes, el nuevo promedio es el costo de la entrada', () => {
    const result = calculateWeightedAverageCost(0, 0, 5, 8);
    expect(result.toFixed(2)).toBe('8.00');
  });

  test('no revienta si la cantidad total queda en cero', () => {
    const result = calculateWeightedAverageCost(0, 0, 0, 0);
    expect(result.toFixed(2)).toBe('0.00');
  });
});

describe('calculateAvailableStock', () => {
  test('resta lo reservado del físico', () => {
    expect(calculateAvailableStock(100, 30).toFixed(2)).toBe('70.00');
  });

  test('puede dar negativo si hay más reservado que físico (sobre-reserva)', () => {
    expect(calculateAvailableStock(10, 15).toFixed(2)).toBe('-5.00');
  });
});
