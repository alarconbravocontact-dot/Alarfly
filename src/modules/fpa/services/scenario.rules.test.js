const { projectScenario, applyScenarioToLiquidityForecast, findFirstNegativeScenarioWeek } = require('./scenario.rules');

describe('projectScenario (Simulador What-If)', () => {
  test('sin ajustes, el proyectado es igual a la línea base', () => {
    const result = projectScenario({
      baselineMonthlyRevenue: 10000,
      baselineMonthlyExpenses: 8000,
      adjustments: [],
      projectionMonths: 6,
    });
    expect(result.projectedMonthlyNetIncome.toNumber()).toBe(2000);
    expect(result.monthlyNetIncomeDelta.toNumber()).toBe(0);
  });

  test('un gasto recurrente nuevo reduce la utilidad mensual proyectada', () => {
    const result = projectScenario({
      baselineMonthlyRevenue: 10000,
      baselineMonthlyExpenses: 8000,
      adjustments: [{ type: 'RECURRING_EXPENSE', monthlyAmount: 500 }],
      projectionMonths: 3,
    });
    expect(result.projectedMonthlyNetIncome.toNumber()).toBe(1500);
    expect(result.monthlyNetIncomeDelta.toNumber()).toBe(-500);
    expect(result.cumulativeNetIncomeDelta.toNumber()).toBe(-1500);
  });

  test('una variación de ventas ajusta el ingreso proporcionalmente', () => {
    const result = projectScenario({
      baselineMonthlyRevenue: 10000,
      baselineMonthlyExpenses: 8000,
      adjustments: [{ type: 'SALES_VARIATION', percentage: 10 }],
      projectionMonths: 1,
    });
    expect(result.projectedMonthlyRevenue.toNumber()).toBe(11000);
  });

  test('varios ajustes se combinan', () => {
    const result = projectScenario({
      baselineMonthlyRevenue: 10000,
      baselineMonthlyExpenses: 8000,
      adjustments: [
        { type: 'SALES_VARIATION', percentage: -10 },
        { type: 'NEW_HIRE', monthlyCost: 1000 },
      ],
      projectionMonths: 12,
    });
    expect(result.projectedMonthlyRevenue.toNumber()).toBe(9000);
    expect(result.projectedMonthlyExpenses.toNumber()).toBe(9000);
    expect(result.projectedMonthlyNetIncome.toNumber()).toBe(0);
  });

  test('rechaza un tipo de ajuste no soportado', () => {
    expect(() =>
      projectScenario({
        baselineMonthlyRevenue: 1000,
        baselineMonthlyExpenses: 500,
        adjustments: [{ type: 'MAGIC_MONEY', monthlyAmount: 100 }],
        projectionMonths: 1,
      })
    ).toThrow('no soportado');
  });

  test('rechaza proyectar 0 o menos meses', () => {
    expect(() =>
      projectScenario({ baselineMonthlyRevenue: 1000, baselineMonthlyExpenses: 500, adjustments: [], projectionMonths: 0 })
    ).toThrow('projectionMonths');
  });

  test('es una función pura: no muta el arreglo de ajustes recibido ni tiene efectos secundarios', () => {
    const adjustments = [{ type: 'RECURRING_EXPENSE', monthlyAmount: 100 }];
    const snapshot = JSON.stringify(adjustments);
    projectScenario({ baselineMonthlyRevenue: 1000, baselineMonthlyExpenses: 500, adjustments, projectionMonths: 1 });
    expect(JSON.stringify(adjustments)).toBe(snapshot);
  });
});

describe('applyScenarioToLiquidityForecast (conexión What-If ↔ Previsión de Liquidez real)', () => {
  const baselineWeeks = [
    { weekStart: new Date('2026-08-01'), weekEnd: new Date('2026-08-07'), projectedBalance: '1000.00' },
    { weekStart: new Date('2026-08-08'), weekEnd: new Date('2026-08-14'), projectedBalance: '1000.00' },
    { weekStart: new Date('2026-08-15'), weekEnd: new Date('2026-08-21'), projectedBalance: '1000.00' },
  ];

  test('con delta mensual cero, la curva del escenario es igual a la línea base', () => {
    const result = applyScenarioToLiquidityForecast(baselineWeeks, 0);
    result.forEach((week, i) => {
      expect(week.scenarioProjectedBalance).toBe(baselineWeeks[i].projectedBalance);
    });
  });

  test('un delta mensual positivo se reparte semanalmente (7/30) y se acumula semana a semana', () => {
    const result = applyScenarioToLiquidityForecast(baselineWeeks, 300);
    // weeklyDelta = 300 * 7/30 = 70
    expect(result[0].scenarioNetChangeFromBaseline).toBe('70.00');
    expect(result[0].scenarioProjectedBalance).toBe('1070.00');
    expect(result[1].scenarioProjectedBalance).toBe('1140.00');
    expect(result[2].scenarioProjectedBalance).toBe('1210.00');
  });

  test('un delta mensual negativo reduce el saldo proyectado semana a semana', () => {
    const result = applyScenarioToLiquidityForecast(baselineWeeks, -300);
    expect(result[0].scenarioProjectedBalance).toBe('930.00');
    expect(result[2].scenarioProjectedBalance).toBe('790.00');
  });

  test('no muta el arreglo de semanas recibido', () => {
    const snapshot = JSON.stringify(baselineWeeks);
    applyScenarioToLiquidityForecast(baselineWeeks, 300);
    expect(JSON.stringify(baselineWeeks)).toBe(snapshot);
  });
});

describe('findFirstNegativeScenarioWeek', () => {
  test('devuelve null si ninguna semana del escenario queda negativa', () => {
    const weeks = [{ scenarioProjectedBalance: '100.00' }, { scenarioProjectedBalance: '50.00' }];
    expect(findFirstNegativeScenarioWeek(weeks)).toBeNull();
  });

  test('devuelve la primera semana del escenario con saldo negativo', () => {
    const weeks = [{ scenarioProjectedBalance: '100.00' }, { scenarioProjectedBalance: '-20.00' }, { scenarioProjectedBalance: '-500.00' }];
    expect(findFirstNegativeScenarioWeek(weeks).scenarioProjectedBalance).toBe('-20.00');
  });
});
