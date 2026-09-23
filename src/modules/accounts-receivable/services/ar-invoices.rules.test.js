const {
  calculateDueDate,
  determineInvoiceStatus,
  applyPaymentToInvoices,
  assertCustomerCreditOk,
  buildSalesTrend,
} = require('./ar-invoices.rules');

describe('calculateDueDate', () => {
  test('suma los días de plazo a la fecha de emisión', () => {
    const due = calculateDueDate(new Date('2026-07-01T00:00:00Z'), 30);
    expect(due.toISOString()).toBe('2026-07-31T00:00:00.000Z');
  });
});

describe('determineInvoiceStatus', () => {
  test('OPEN cuando no se ha pagado nada', () => {
    expect(determineInvoiceStatus(1000, 0)).toBe('OPEN');
  });
  test('PARTIALLY_PAID cuando se pagó una parte', () => {
    expect(determineInvoiceStatus(1000, 400)).toBe('PARTIALLY_PAID');
  });
  test('PAID cuando se pagó todo (o más, por redondeo)', () => {
    expect(determineInvoiceStatus(1000, 1000)).toBe('PAID');
  });
});

describe('applyPaymentToInvoices', () => {
  const invoicesById = new Map([
    ['inv1', { id: 'inv1', invoiceNumber: 1, totalAmount: '500.00', paidAmount: '0.00' }],
    ['inv2', { id: 'inv2', invoiceNumber: 2, totalAmount: '300.00', paidAmount: '100.00' }],
  ]);

  test('reparte un cobro entre dos facturas exactamente', () => {
    const results = applyPaymentToInvoices(
      700,
      [
        { invoiceId: 'inv1', amount: 500 },
        { invoiceId: 'inv2', amount: 200 },
      ],
      invoicesById
    );
    expect(results[0].newStatus).toBe('PAID');
    expect(results[1].newStatus).toBe('PAID');
  });

  test('rechaza si la suma aplicada no coincide con el monto del cobro', () => {
    expect(() => applyPaymentToInvoices(700, [{ invoiceId: 'inv1', amount: 500 }], invoicesById)).toThrow(
      'debe ser igual al monto del cobro'
    );
  });

  test('rechaza si se aplica más de lo que debe una factura', () => {
    expect(() => applyPaymentToInvoices(600, [{ invoiceId: 'inv1', amount: 600 }], invoicesById)).toThrow(
      'supera su saldo pendiente'
    );
  });

  test('rechaza una factura que no existe', () => {
    expect(() => applyPaymentToInvoices(100, [{ invoiceId: 'inv-x', amount: 100 }], invoicesById)).toThrow(
      'no existe o no pertenece'
    );
  });
});

describe('assertCustomerCreditOk', () => {
  const baseCustomer = { name: 'Cliente Demo', isBlocked: false, creditLimit: null, maxOverdueDaysAllowed: null };

  test('no bloquea cuando no hay ningún umbral configurado', () => {
    expect(() =>
      assertCustomerCreditOk({ customer: baseCustomer, currentOpenBalance: 100000, newInvoiceAmount: 100000, maxDaysOverdueFound: 500 })
    ).not.toThrow();
  });

  test('rechaza un cliente bloqueado, sin importar los demás campos', () => {
    const customer = { ...baseCustomer, isBlocked: true, blockedReason: 'Atraso crítico' };
    expect(() => assertCustomerCreditOk({ customer, currentOpenBalance: 0, newInvoiceAmount: 1 })).toThrow('Atraso crítico');
  });

  test('rechaza si la factura nueva supera el límite de crédito', () => {
    const customer = { ...baseCustomer, creditLimit: 1000 };
    expect(() => assertCustomerCreditOk({ customer, currentOpenBalance: 800, newInvoiceAmount: 300 })).toThrow(
      'supera su límite de crédito'
    );
  });

  test('permite si la factura nueva queda justo en el límite', () => {
    const customer = { ...baseCustomer, creditLimit: 1000 };
    expect(() => assertCustomerCreditOk({ customer, currentOpenBalance: 800, newInvoiceAmount: 200 })).not.toThrow();
  });

  test('rechaza si el cliente tiene facturas más atrasadas de lo permitido', () => {
    const customer = { ...baseCustomer, maxOverdueDaysAllowed: 15 };
    expect(() =>
      assertCustomerCreditOk({ customer, currentOpenBalance: 0, newInvoiceAmount: 1, maxDaysOverdueFound: 20 })
    ).toThrow('vencidas hace 20 días');
  });

  test('permite si el atraso está dentro del umbral', () => {
    const customer = { ...baseCustomer, maxOverdueDaysAllowed: 15 };
    expect(() =>
      assertCustomerCreditOk({ customer, currentOpenBalance: 0, newInvoiceAmount: 1, maxDaysOverdueFound: 10 })
    ).not.toThrow();
  });
});

describe('buildSalesTrend', () => {
  const referenceDate = new Date('2026-07-16T00:00:00Z');

  test('devuelve un punto por cada mes pedido, en 0 si no hubo facturas', () => {
    const trend = buildSalesTrend([], 3, referenceDate);
    expect(trend).toEqual([
      { month: '2026-05', totalSales: '0.00', invoiceCount: 0 },
      { month: '2026-06', totalSales: '0.00', invoiceCount: 0 },
      { month: '2026-07', totalSales: '0.00', invoiceCount: 0 },
    ]);
  });

  test('suma el total y cuenta las facturas del mismo mes', () => {
    const invoices = [
      { issueDate: new Date('2026-07-02T00:00:00Z'), totalAmount: 100 },
      { issueDate: new Date('2026-07-20T00:00:00Z'), totalAmount: 250.5 },
      { issueDate: new Date('2026-06-15T00:00:00Z'), totalAmount: 40 },
    ];
    const trend = buildSalesTrend(invoices, 2, referenceDate);
    expect(trend).toEqual([
      { month: '2026-06', totalSales: '40.00', invoiceCount: 1 },
      { month: '2026-07', totalSales: '350.50', invoiceCount: 2 },
    ]);
  });

  test('ignora facturas fuera del rango de meses pedido', () => {
    const invoices = [{ issueDate: new Date('2026-01-01T00:00:00Z'), totalAmount: 999 }];
    const trend = buildSalesTrend(invoices, 2, referenceDate);
    const total = trend.reduce((sum, b) => sum + Number(b.totalSales), 0);
    expect(total).toBe(0);
  });
});
