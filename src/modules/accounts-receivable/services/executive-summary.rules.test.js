const { buildDailyFlowTrend, buildReceivableBalanceTrend } = require('./executive-summary.rules');

const REF = new Date('2026-07-20T15:00:00Z');

describe('executive-summary.rules', () => {
  describe('buildDailyFlowTrend', () => {
    test('un día sin actividad aparece en 0, nunca se salta', () => {
      const trend = buildDailyFlowTrend([], 'date', 'amount', 5, REF);
      expect(trend).toHaveLength(5);
      expect(trend.every((d) => d.value === '0.00')).toBe(true);
      expect(trend[4].date).toBe('2026-07-20');
      expect(trend[0].date).toBe('2026-07-16');
    });

    test('suma correctamente varios items en el mismo día', () => {
      const items = [
        { date: new Date('2026-07-19T08:00:00Z'), amount: 100 },
        { date: new Date('2026-07-19T20:00:00Z'), amount: 50.5 },
        { date: new Date('2026-07-20T00:00:00Z'), amount: 10 },
      ];
      const trend = buildDailyFlowTrend(items, 'date', 'amount', 5, REF);
      const day19 = trend.find((d) => d.date === '2026-07-19');
      const day20 = trend.find((d) => d.date === '2026-07-20');
      expect(day19.value).toBe('150.50');
      expect(day20.value).toBe('10.00');
    });

    test('ignora items fuera del rango de días pedido', () => {
      const items = [{ date: new Date('2026-01-01T00:00:00Z'), amount: 999 }];
      const trend = buildDailyFlowTrend(items, 'date', 'amount', 5, REF);
      expect(trend.every((d) => d.value === '0.00')).toBe(true);
    });
  });

  describe('buildReceivableBalanceTrend', () => {
    test('factura sin ningún cobro aplicado se ve como saldo completo desde su emisión', () => {
      const invoices = [{ id: 'inv1', issueDate: new Date('2026-07-18T00:00:00Z'), dueDate: new Date('2026-08-01T00:00:00Z'), totalAmount: 500 }];
      const trend = buildReceivableBalanceTrend(invoices, [], 5, REF);
      expect(trend.find((d) => d.date === '2026-07-17').receivable).toBe('0.00'); // antes de emitirse
      expect(trend.find((d) => d.date === '2026-07-18').receivable).toBe('500.00'); // el mismo día
      expect(trend.find((d) => d.date === '2026-07-20').receivable).toBe('500.00');
      expect(trend.find((d) => d.date === '2026-07-20').overdue).toBe('0.00'); // no vencida todavía
    });

    test('un cobro aplicado reduce el saldo desde el día del cobro en adelante, no antes', () => {
      const invoices = [{ id: 'inv1', issueDate: new Date('2026-07-16T00:00:00Z'), dueDate: new Date('2026-08-01T00:00:00Z'), totalAmount: 500 }];
      const applications = [{ invoiceId: 'inv1', amount: 200, paymentDate: new Date('2026-07-19T00:00:00Z') }];
      const trend = buildReceivableBalanceTrend(invoices, applications, 5, REF);
      expect(trend.find((d) => d.date === '2026-07-18').receivable).toBe('500.00');
      expect(trend.find((d) => d.date === '2026-07-19').receivable).toBe('300.00');
      expect(trend.find((d) => d.date === '2026-07-20').receivable).toBe('300.00');
    });

    test('una factura vencida cuenta como "overdue" desde el día siguiente a su vencimiento', () => {
      const invoices = [{ id: 'inv1', issueDate: new Date('2026-07-10T00:00:00Z'), dueDate: new Date('2026-07-18T00:00:00Z'), totalAmount: 100 }];
      const trend = buildReceivableBalanceTrend(invoices, [], 5, REF);
      expect(trend.find((d) => d.date === '2026-07-18').overdue).toBe('0.00'); // el mismo día del vencimiento todavía no
      expect(trend.find((d) => d.date === '2026-07-19').overdue).toBe('100.00');
      expect(trend.find((d) => d.date === '2026-07-20').overdue).toBe('100.00');
    });

    test('una factura totalmente pagada deja de contar como saldo (nunca queda en negativo)', () => {
      const invoices = [{ id: 'inv1', issueDate: new Date('2026-07-16T00:00:00Z'), dueDate: new Date('2026-08-01T00:00:00Z'), totalAmount: 500 }];
      const applications = [{ invoiceId: 'inv1', amount: 500, paymentDate: new Date('2026-07-17T00:00:00Z') }];
      const trend = buildReceivableBalanceTrend(invoices, applications, 5, REF);
      expect(trend.find((d) => d.date === '2026-07-20').receivable).toBe('0.00');
    });
  });
});
