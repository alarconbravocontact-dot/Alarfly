const { buildLiquidityInsight, buildCollectionsInsight } = require('./insights.rules');

describe('insights.rules — buildLiquidityInsight (Fase 12)', () => {
  test('devuelve null si no hay ninguna semana con saldo negativo (nunca inventa una alerta sin evidencia)', () => {
    const result = buildLiquidityInsight({
      cashOnHand: '10000.00',
      overdueReceivable: '0.00',
      firstNegativeWeek: null,
      baseCurrency: 'USD',
    });
    expect(result).toBeNull();
  });

  test('severidad CRITICAL cuando la semana negativa cae dentro de 14 días', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const result = buildLiquidityInsight(
      {
        cashOnHand: '5000.00',
        overdueReceivable: '3000.00',
        firstNegativeWeek: { weekStart: '2026-01-10T00:00:00Z', projectedBalance: '-500.00' },
        baseCurrency: 'USD',
      },
      now
    );
    expect(result.severity).toBe('CRITICAL');
    expect(result.daysUntilNegative).toBe(9);
    expect(result.evidence).toHaveLength(3);
    expect(result.description).toContain('3000.00');
    expect(result.action).toEqual({ label: 'Ver cobros', to: '/cuentas/cobros' });
  });

  test('severidad WARNING cuando la semana negativa cae después de 14 días', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const result = buildLiquidityInsight(
      {
        cashOnHand: '5000.00',
        overdueReceivable: '0.00',
        firstNegativeWeek: { weekStart: '2026-02-01T00:00:00Z', projectedBalance: '-100.00' },
        baseCurrency: 'USD',
      },
      now
    );
    expect(result.severity).toBe('WARNING');
    expect(result.description).toContain('No hay cuentas por cobrar vencidas');
  });
});

describe('insights.rules — buildCollectionsInsight (Fase 12)', () => {
  test('devuelve null si ningún cliente tiene saldo vencido', () => {
    const rows = [{ name: 'Cliente A', bucket: 'CURRENT', balance: '100.00', daysOverdue: -5 }];
    expect(buildCollectionsInsight(rows)).toBeNull();
  });

  test('ordena por saldo vencido descendente y limita al top N', () => {
    const rows = [
      { name: 'Cliente A', bucket: 'DAYS_1_30', balance: '500.00', daysOverdue: 10 },
      { name: 'Cliente B', bucket: 'DAYS_90_PLUS', balance: '5000.00', daysOverdue: 120 },
      { name: 'Cliente C', bucket: 'DAYS_31_60', balance: '2000.00', daysOverdue: 45 },
      { name: 'Cliente D', bucket: 'CURRENT', balance: '9999.00', daysOverdue: -3 },
    ];
    const result = buildCollectionsInsight(rows, { limit: 2 });
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0].name).toBe('Cliente B');
    expect(result.evidence[1].name).toBe('Cliente C');
    expect(result.evidence.find((c) => c.name === 'Cliente D')).toBeUndefined();
  });

  test('la severidad del insight refleja el peor caso entre los clientes mostrados', () => {
    const rows = [{ name: 'Cliente A', bucket: 'DAYS_90_PLUS', balance: '100.00', daysOverdue: 100 }];
    const result = buildCollectionsInsight(rows);
    expect(result.severity).toBe('CRITICAL');
    expect(result.evidence[0].severity).toBe('CRITICAL');
  });

  test('el total vencido cuenta a TODOS los clientes vencidos, no solo al top N mostrado', () => {
    const rows = [
      { name: 'Cliente A', bucket: 'DAYS_1_30', balance: '100.00', daysOverdue: 5 },
      { name: 'Cliente B', bucket: 'DAYS_1_30', balance: '200.00', daysOverdue: 5 },
      { name: 'Cliente C', bucket: 'DAYS_1_30', balance: '300.00', daysOverdue: 5 },
    ];
    const result = buildCollectionsInsight(rows, { limit: 1 });
    expect(result.description).toContain('3 cliente(s)');
    expect(result.description).toContain('600.00');
  });
});
