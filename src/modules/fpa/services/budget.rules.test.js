const {
  determineNextVersion,
  assertCanTransition,
  resolveBudgetLineAmounts,
  calculateVariance,
  exceedsThreshold,
} = require('./budget.rules');

describe('determineNextVersion (versionado de presupuestos)', () => {
  test('una ORIGINAL nueva en un año sin versiones previas queda en versión 1', () => {
    expect(determineNextVersion([], 'ORIGINAL')).toBe(1);
  });

  test('rechaza una segunda ORIGINAL en el mismo año fiscal', () => {
    expect(() => determineNextVersion([1], 'ORIGINAL')).toThrow('Ya existe una versión ORIGINAL');
  });

  test('rechaza un REFORECAST sin ninguna versión previa', () => {
    expect(() => determineNextVersion([], 'REFORECAST')).toThrow('sin una versión ORIGINAL previa');
  });

  test('un REFORECAST toma el siguiente número disponible', () => {
    expect(determineNextVersion([1], 'REFORECAST')).toBe(2);
    expect(determineNextVersion([1, 2], 'REFORECAST')).toBe(3);
  });
});

describe('assertCanTransition (flujo de estado de un presupuesto)', () => {
  test('permite DRAFT -> IN_REVIEW', () => {
    expect(() => assertCanTransition('DRAFT', 'IN_REVIEW')).not.toThrow();
  });

  test('permite IN_REVIEW -> APPROVED', () => {
    expect(() => assertCanTransition('IN_REVIEW', 'APPROVED')).not.toThrow();
  });

  test('permite devolver IN_REVIEW -> DRAFT para corregir', () => {
    expect(() => assertCanTransition('IN_REVIEW', 'DRAFT')).not.toThrow();
  });

  test('rechaza saltar de DRAFT directo a APPROVED', () => {
    expect(() => assertCanTransition('DRAFT', 'APPROVED')).toThrow('No se puede pasar');
  });

  test('rechaza cualquier transición desde APPROVED', () => {
    expect(() => assertCanTransition('APPROVED', 'DRAFT')).toThrow('No se puede pasar');
  });
});

describe('resolveBudgetLineAmounts (reparto por regla/driver)', () => {
  test('una línea FIXED se toma tal cual', () => {
    const lines = [{ id: 'l1', accountCode: '4135', period: 1, amountType: 'FIXED', amount: 10000 }];
    const resolved = resolveBudgetLineAmounts(lines);
    expect(resolved.get('l1').toNumber()).toBe(10000);
  });

  test('una línea FORMULA se reparte como % de otra línea FIXED (driver)', () => {
    const lines = [
      { id: 'revenue', accountCode: '4135', period: 1, amountType: 'FIXED', amount: 10000 },
      { id: 'commission', accountCode: '5210', period: 1, amountType: 'FORMULA', formula: '[4135_1] * 0.05' },
    ];
    const resolved = resolveBudgetLineAmounts(lines);
    expect(resolved.get('commission').toNumber()).toBe(500);
  });

  test('una fórmula que referencia una línea inexistente falla', () => {
    const lines = [{ id: 'l1', accountCode: '5210', period: 1, amountType: 'FORMULA', formula: '[9999_1] * 2' }];
    expect(() => resolveBudgetLineAmounts(lines)).toThrow('variable desconocida');
  });
});

describe('calculateVariance / exceedsThreshold (desviación presupuesto vs. real)', () => {
  test('lo real igual a lo presupuestado da 0% de desviación', () => {
    const { variancePercentage } = calculateVariance(1000, 1000);
    expect(variancePercentage.toNumber()).toBe(0);
  });

  test('lo real 20% por encima de lo presupuestado', () => {
    const { varianceAmount, variancePercentage } = calculateVariance(1000, 1200);
    expect(varianceAmount.toNumber()).toBe(200);
    expect(variancePercentage.toNumber()).toBe(20);
  });

  test('presupuesto en cero y real en cero no es desviación', () => {
    const { variancePercentage } = calculateVariance(0, 0);
    expect(variancePercentage.toNumber()).toBe(0);
  });

  test('presupuesto en cero con algo real gastado es 100% de desviación (nunca división entre cero)', () => {
    const { varianceAmount, variancePercentage } = calculateVariance(0, 350);
    expect(varianceAmount.toNumber()).toBe(350);
    expect(variancePercentage.toNumber()).toBe(100);
  });

  test('exceedsThreshold compara valor absoluto contra el umbral', () => {
    expect(exceedsThreshold(15, 10)).toBe(true);
    expect(exceedsThreshold(-15, 10)).toBe(true);
    expect(exceedsThreshold(5, 10)).toBe(false);
  });
});
