const { assertNoCycle } = require('./fpa-dimensions.rules');

describe('assertNoCycle (jerarquía de dimensiones FP&A)', () => {
  test('permite asignar padre cuando no hay ciclo', () => {
    const all = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: null },
    ];
    expect(() => assertNoCycle('c', 'b', all)).not.toThrow();
  });

  test('no hace nada si no se manda padre nuevo', () => {
    const all = [{ id: 'a', parentId: null }];
    expect(() => assertNoCycle('a', null, all)).not.toThrow();
  });

  test('rechaza que una dimensión sea su propio padre', () => {
    const all = [{ id: 'a', parentId: null }];
    expect(() => assertNoCycle('a', 'a', all)).toThrow('propia dimensión padre');
  });

  test('rechaza un ciclo directo (A padre de B, B padre de A)', () => {
    const all = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
    ];
    expect(() => assertNoCycle('a', 'b', all)).toThrow('crearía un ciclo');
  });

  test('rechaza un ciclo indirecto (A > B > C, y se intenta C > A)', () => {
    const all = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
    ];
    expect(() => assertNoCycle('a', 'c', all)).toThrow('crearía un ciclo');
  });
});
