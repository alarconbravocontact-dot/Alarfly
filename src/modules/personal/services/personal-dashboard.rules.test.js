const { buildCostTrend } = require('./personal-dashboard.rules');

describe('personal-dashboard.rules.buildCostTrend', () => {
  const referenceDate = new Date(Date.UTC(2026, 9, 6)); // 2026-10-06

  test('un mes sin costo real queda en 0, nunca se salta', () => {
    const trend = buildCostTrend([], [], 3, referenceDate);
    expect(trend).toHaveLength(3);
    expect(trend.map((t) => t.value)).toEqual(['0.00', '0.00', '0.00']);
  });

  test('suma nómina pagada y gastos reembolsados en el mismo mes', () => {
    const paidPayrolls = [{ paymentDate: new Date(Date.UTC(2026, 9, 1)), netTotal: 1500 }];
    const reimbursedExpenses = [{ reimbursedAt: new Date(Date.UTC(2026, 9, 15)), amount: 80 }];

    const trend = buildCostTrend(paidPayrolls, reimbursedExpenses, 3, referenceDate);

    expect(trend).toHaveLength(3);
    expect(trend[2].value).toBe('1580.00'); // último punto = mes actual (octubre)
    expect(trend[0].value).toBe('0.00');
  });

  test('ignora pagos/reembolsos fuera del rango de meses pedido', () => {
    const paidPayrolls = [{ paymentDate: new Date(Date.UTC(2026, 0, 1)), netTotal: 999 }]; // enero, fuera de 3 meses
    const trend = buildCostTrend(paidPayrolls, [], 3, referenceDate);
    expect(trend.every((t) => t.value === '0.00')).toBe(true);
  });

  test('el último punto siempre corresponde al mes de referencia', () => {
    const trend = buildCostTrend([], [], 6, referenceDate);
    const lastDate = new Date(trend[trend.length - 1].date);
    expect(lastDate.getUTCFullYear()).toBe(2026);
    expect(lastDate.getUTCMonth()).toBe(9); // octubre (0-indexed)
  });
});
