const { evaluateCondition } = require('./fiscal-risk.rules');

describe('evaluateCondition (motor de reglas de riesgo fiscal)', () => {
  test('comparación simple gt', () => {
    expect(evaluateCondition({ field: 'taxBase', op: 'gt', value: 500 }, { taxBase: 1000 })).toBe(true);
    expect(evaluateCondition({ field: 'taxBase', op: 'gt', value: 500 }, { taxBase: 100 })).toBe(false);
  });

  test('comparación eq', () => {
    expect(evaluateCondition({ field: 'type', op: 'eq', value: 'PURCHASE' }, { type: 'PURCHASE' })).toBe(true);
    expect(evaluateCondition({ field: 'type', op: 'eq', value: 'PURCHASE' }, { type: 'SALE' })).toBe(false);
  });

  test('exists / not_exists', () => {
    expect(evaluateCondition({ field: 'counterpartyTaxId', op: 'exists' }, { counterpartyTaxId: '900123456' })).toBe(true);
    expect(evaluateCondition({ field: 'counterpartyTaxId', op: 'not_exists' }, { counterpartyTaxId: '' })).toBe(true);
  });

  test('"all" exige que se cumplan todas las condiciones (Y)', () => {
    const condition = {
      all: [
        { field: 'type', op: 'eq', value: 'PURCHASE' },
        { field: 'withholdingAmount', op: 'eq', value: 0 },
        { field: 'taxBase', op: 'gt', value: 500 },
      ],
    };
    expect(evaluateCondition(condition, { type: 'PURCHASE', withholdingAmount: 0, taxBase: 900 })).toBe(true);
    expect(evaluateCondition(condition, { type: 'PURCHASE', withholdingAmount: 10, taxBase: 900 })).toBe(false);
  });

  test('"any" exige que se cumpla al menos una condición (O)', () => {
    const condition = { any: [{ field: 'taxBase', op: 'gt', value: 10000 }, { field: 'hasWithholding', op: 'eq', value: false }] };
    expect(evaluateCondition(condition, { taxBase: 50, hasWithholding: false })).toBe(true);
    expect(evaluateCondition(condition, { taxBase: 50, hasWithholding: true })).toBe(false);
  });

  test('rechaza un operador no soportado', () => {
    expect(() => evaluateCondition({ field: 'taxBase', op: 'unsupported_op', value: 1 }, {})).toThrow('operador');
  });

  test('rechaza una condición sin forma reconocible', () => {
    expect(() => evaluateCondition({ foo: 'bar' }, {})).toThrow();
  });
});
