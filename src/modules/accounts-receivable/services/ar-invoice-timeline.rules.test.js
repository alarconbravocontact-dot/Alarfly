const { buildInvoiceTimelineSteps, computeFirstActionGapDays, detectUnusualDelay } = require('./ar-invoice-timeline.rules');

describe('buildInvoiceTimelineSteps', () => {
  test('mapea creación, cobro y nota de crédito con su documento relacionado', () => {
    const entries = [
      { id: 'a1', createdAt: '2026-07-01T00:00:00Z', user: { name: 'Ana' }, action: 'ar_invoice.created', entityType: 'ArInvoice', entityId: 'inv1' },
      { id: 'a2', createdAt: '2026-07-10T00:00:00Z', user: { name: 'Beto' }, action: 'ar_payment.recorded', entityType: 'ArPayment', entityId: 'pay123456' },
      { id: 'a3', createdAt: '2026-07-15T00:00:00Z', user: null, action: 'ar_credit_note.created', entityType: 'ArCreditNote', entityId: 'cn1' },
    ];
    const context = {
      paymentApplicationsByPaymentId: { pay123456: { amount: '100.00' } },
      creditNotesById: { cn1: { type: 'CREDIT', noteNumber: 45 } },
    };
    const steps = buildInvoiceTimelineSteps(entries, context);

    expect(steps[0]).toMatchObject({ label: 'Factura registrada', userName: 'Ana', relatedDocument: null });
    expect(steps[1]).toMatchObject({ label: 'Cobro aplicado (100.00)', userName: 'Beto', relatedDocument: 'Cobro #123456' });
    expect(steps[2]).toMatchObject({ label: 'Nota de crédito aplicada', userName: 'Sistema', relatedDocument: 'Nota de crédito #45' });
  });

  test('ordena los pasos por fecha aunque lleguen desordenados', () => {
    const entries = [
      { id: 'a2', createdAt: '2026-07-15T00:00:00Z', user: null, action: 'ar_payment.recorded', entityType: 'ArPayment', entityId: 'p1' },
      { id: 'a1', createdAt: '2026-07-01T00:00:00Z', user: null, action: 'ar_invoice.created', entityType: 'ArInvoice', entityId: 'inv1' },
    ];
    const steps = buildInvoiceTimelineSteps(entries, { paymentApplicationsByPaymentId: {}, creditNotesById: {} });
    expect(steps.map((s) => s.auditLogId)).toEqual(['a1', 'a2']);
  });
});

describe('computeFirstActionGapDays', () => {
  test('null si solo hay un paso (recién creada, sin movimientos)', () => {
    expect(computeFirstActionGapDays([{ date: '2026-07-01T00:00:00Z' }])).toBeNull();
  });

  test('días entre el primer y el segundo paso', () => {
    const steps = [{ date: '2026-07-01T00:00:00Z' }, { date: '2026-07-10T00:00:00Z' }];
    expect(computeFirstActionGapDays(steps)).toBe(9);
  });
});

describe('detectUnusualDelay', () => {
  test('sin anomalía si no hay suficientes facturas históricas para comparar', () => {
    expect(detectUnusualDelay(30, [10])).toEqual({ isAnomaly: false, averageDays: null });
  });

  test('sin anomalía si el gap actual está dentro de lo normal', () => {
    const result = detectUnusualDelay(12, [10, 14, 8]);
    expect(result.isAnomaly).toBe(false);
    expect(result.averageDays).toBeCloseTo(10.67, 1);
  });

  test('anomalía si el gap actual supera el doble del promedio histórico', () => {
    const result = detectUnusualDelay(30, [10, 12, 8]);
    expect(result.isAnomaly).toBe(true);
    expect(result.averageDays).toBe(10);
  });

  test('sin factura sin ningún movimiento (gap null) no hay anomalía', () => {
    expect(detectUnusualDelay(null, [10, 12])).toEqual({ isAnomaly: false, averageDays: null });
  });

  test('ignora muestras históricas nulas (facturas sin movimientos todavía) al promediar', () => {
    const result = detectUnusualDelay(25, [10, null, 12, null]);
    expect(result.averageDays).toBe(11);
    expect(result.isAnomaly).toBe(true);
  });

  test('anomalía cuando el promedio histórico es 0 (cliente que siempre reacciona el mismo día) y esta vez tardó semanas', () => {
    const result = detectUnusualDelay(45, [0, 0, 0]);
    expect(result.averageDays).toBe(0);
    expect(result.isAnomaly).toBe(true);
  });
});
