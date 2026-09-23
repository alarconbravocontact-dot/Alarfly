const { calculateDueDate, determineBillStatus, applyPaymentToBills } = require('./ap-bills.rules');

describe('calculateDueDate', () => {
  test('suma los días de plazo a la fecha de emisión', () => {
    const due = calculateDueDate(new Date('2026-07-01T00:00:00Z'), 15);
    expect(due.toISOString()).toBe('2026-07-16T00:00:00.000Z');
  });
});

describe('determineBillStatus', () => {
  test('OPEN cuando no se ha pagado nada', () => {
    expect(determineBillStatus(1000, 0)).toBe('OPEN');
  });
  test('PARTIALLY_PAID cuando se pagó una parte', () => {
    expect(determineBillStatus(1000, 400)).toBe('PARTIALLY_PAID');
  });
  test('PAID cuando se pagó todo', () => {
    expect(determineBillStatus(1000, 1000)).toBe('PAID');
  });
});

describe('applyPaymentToBills', () => {
  const billsById = new Map([
    ['bill1', { id: 'bill1', billNumber: 1, totalAmount: '500.00', paidAmount: '0.00' }],
    ['bill2', { id: 'bill2', billNumber: 2, totalAmount: '300.00', paidAmount: '100.00' }],
  ]);

  test('reparte un pago entre dos facturas exactamente', () => {
    const results = applyPaymentToBills(
      700,
      [
        { billId: 'bill1', amount: 500 },
        { billId: 'bill2', amount: 200 },
      ],
      billsById
    );
    expect(results[0].newStatus).toBe('PAID');
    expect(results[1].newStatus).toBe('PAID');
  });

  test('rechaza si la suma aplicada no coincide con el monto del pago', () => {
    expect(() => applyPaymentToBills(700, [{ billId: 'bill1', amount: 500 }], billsById)).toThrow(
      'debe ser igual al monto del pago'
    );
  });

  test('rechaza si se aplica más de lo que debe una factura', () => {
    expect(() => applyPaymentToBills(600, [{ billId: 'bill1', amount: 600 }], billsById)).toThrow('supera su saldo pendiente');
  });

  test('rechaza una factura que no existe', () => {
    expect(() => applyPaymentToBills(100, [{ billId: 'bill-x', amount: 100 }], billsById)).toThrow('no existe o no pertenece');
  });
});
