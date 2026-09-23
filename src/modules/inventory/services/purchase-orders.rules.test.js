const {
  calculateSuggestedReorderQuantity,
  calculateReceiptDiscrepancy,
  determinePurchaseOrderStatus,
} = require('./purchase-orders.rules');

describe('calculateSuggestedReorderQuantity', () => {
  it('sugiere hasta el máximo cuando hay máximo configurado', () => {
    expect(calculateSuggestedReorderQuantity(10, 20, 50).toNumber()).toBe(40);
  });

  it('usa el doble del mínimo como meta cuando no hay máximo', () => {
    expect(calculateSuggestedReorderQuantity(5, 20, null).toNumber()).toBe(35);
  });

  it('nunca sugiere una cantidad negativa', () => {
    expect(calculateSuggestedReorderQuantity(100, 20, 50).toNumber()).toBe(0);
  });
});

describe('calculateReceiptDiscrepancy', () => {
  it('no marca discrepancia cuando se recibe exactamente lo pedido', () => {
    const result = calculateReceiptDiscrepancy(100, 100);
    expect(result.hasDiscrepancy).toBe(false);
    expect(result.discrepancy.toNumber()).toBe(0);
  });

  it('marca discrepancia cuando se recibe menos de lo pedido', () => {
    const result = calculateReceiptDiscrepancy(100, 80);
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.discrepancy.toNumber()).toBe(-20);
  });

  it('marca discrepancia cuando se recibe más de lo pedido', () => {
    const result = calculateReceiptDiscrepancy(100, 110);
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.discrepancy.toNumber()).toBe(10);
  });
});

describe('determinePurchaseOrderStatus', () => {
  it('queda RECEIVED cuando todas las líneas están completas', () => {
    const lines = [
      { quantityOrdered: 10, quantityReceived: 10 },
      { quantityOrdered: 5, quantityReceived: 5 },
    ];
    expect(determinePurchaseOrderStatus(lines, 'SUBMITTED')).toBe('RECEIVED');
  });

  it('queda PARTIALLY_RECEIVED cuando algo llegó pero no todo', () => {
    const lines = [
      { quantityOrdered: 10, quantityReceived: 10 },
      { quantityOrdered: 5, quantityReceived: 2 },
    ];
    expect(determinePurchaseOrderStatus(lines, 'SUBMITTED')).toBe('PARTIALLY_RECEIVED');
  });

  it('mantiene el estado actual cuando nada se ha recibido', () => {
    const lines = [{ quantityOrdered: 10, quantityReceived: 0 }];
    expect(determinePurchaseOrderStatus(lines, 'SUBMITTED')).toBe('SUBMITTED');
  });
});
