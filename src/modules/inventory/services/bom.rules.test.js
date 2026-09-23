const { explodeBomComponents } = require('./bom.rules');

describe('explodeBomComponents', () => {
  test('multiplica la cantidad de cada componente por lo vendido del padre', () => {
    const components = [
      { componentVariantId: 'c1', quantity: 2 },
      { componentVariantId: 'c2', quantity: 0.5 },
    ];
    const result = explodeBomComponents(components, 10);
    expect(result[0]).toMatchObject({ componentVariantId: 'c1' });
    expect(result[0].quantityToConsume.toFixed(2)).toBe('20.00');
    expect(result[1].quantityToConsume.toFixed(2)).toBe('5.00');
  });

  test('lista vacía de componentes da lista vacía (producto sin BOM real)', () => {
    expect(explodeBomComponents([], 10)).toEqual([]);
  });
});
