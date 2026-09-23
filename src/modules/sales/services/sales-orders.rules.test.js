const {
  calculateLineAmount,
  determineOrderStatus,
  remainingToDeliver,
  remainingToInvoice,
  averageDeliveredUnitCost,
} = require('./sales-orders.rules');

describe('calculateLineAmount', () => {
  test('cantidad por precio, con descuento restado', () => {
    expect(calculateLineAmount(4, 25, 10).toNumber()).toBe(90);
  });

  test('sin descuento por defecto', () => {
    expect(calculateLineAmount(2, 15).toNumber()).toBe(30);
  });
});

describe('determineOrderStatus', () => {
  test('sin líneas físicas, queda CONFIRMED', () => {
    expect(determineOrderStatus([])).toBe('CONFIRMED');
  });

  test('ninguna línea entregada todavía', () => {
    const lines = [{ quantity: 10, deliveredQuantity: 0 }];
    expect(determineOrderStatus(lines)).toBe('CONFIRMED');
  });

  test('algunas líneas entregadas parcialmente', () => {
    const lines = [
      { quantity: 10, deliveredQuantity: 4 },
      { quantity: 5, deliveredQuantity: 0 },
    ];
    expect(determineOrderStatus(lines)).toBe('PARTIALLY_DELIVERED');
  });

  test('todas las líneas completamente entregadas', () => {
    const lines = [
      { quantity: 10, deliveredQuantity: 10 },
      { quantity: 5, deliveredQuantity: 5 },
    ];
    expect(determineOrderStatus(lines)).toBe('DELIVERED');
  });
});

describe('remainingToDeliver / remainingToInvoice', () => {
  test('resta simple', () => {
    expect(remainingToDeliver({ quantity: 20, deliveredQuantity: 12 }).toNumber()).toBe(8);
    expect(remainingToInvoice({ deliveredQuantity: 12, invoicedQuantity: 5 }).toNumber()).toBe(7);
  });

  test('nunca negativo aunque haya sobre-entrega/sobre-facturación por error de redondeo', () => {
    expect(remainingToDeliver({ quantity: 10, deliveredQuantity: 10.0001 }).toNumber()).toBe(0);
    expect(remainingToInvoice({ deliveredQuantity: 10, invoicedQuantity: 10.0001 }).toNumber()).toBe(0);
  });
});

describe('averageDeliveredUnitCost', () => {
  test('promedio real de lo entregado, nunca un cálculo nuevo', () => {
    expect(averageDeliveredUnitCost({ deliveredQuantity: 12, deliveredCostTotal: 120 }).toNumber()).toBe(10);
  });

  test('cero entregado da costo cero, sin dividir entre cero', () => {
    expect(averageDeliveredUnitCost({ deliveredQuantity: 0, deliveredCostTotal: 0 }).toNumber()).toBe(0);
  });
});
