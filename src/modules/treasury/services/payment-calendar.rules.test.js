const { groupDocumentsByDay, detectHighConcentrationDays } = require('./payment-calendar.rules');

describe('groupDocumentsByDay', () => {
  test('agrupa documentos del mismo día, sumando monto y contando', () => {
    const documents = [
      { id: 'a', date: new Date('2026-07-10T00:00:00Z'), amount: 100 },
      { id: 'b', date: new Date('2026-07-10T00:00:00Z'), amount: 50 },
      { id: 'c', date: new Date('2026-07-11T00:00:00Z'), amount: 200 },
    ];
    const groups = groupDocumentsByDay(documents);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ date: '2026-07-10', totalAmount: '150.00', count: 2 });
    expect(groups[1]).toMatchObject({ date: '2026-07-11', totalAmount: '200.00', count: 1 });
  });

  test('lista vacía devuelve arreglo vacío', () => {
    expect(groupDocumentsByDay([])).toEqual([]);
  });
});

describe('detectHighConcentrationDays', () => {
  test('marca un día cuyo monto total duplica el promedio de los días con pagos', () => {
    const dayGroups = [
      { date: '2026-07-10', totalAmount: '100.00', count: 1 },
      { date: '2026-07-11', totalAmount: '100.00', count: 1 },
      { date: '2026-07-12', totalAmount: '600.00', count: 1 }, // muy por encima del promedio (~267)
    ];
    expect(detectHighConcentrationDays(dayGroups)).toEqual(['2026-07-12']);
  });

  test('marca un día con muchos documentos aunque el monto no sea alto', () => {
    const dayGroups = [
      { date: '2026-07-10', totalAmount: '30.00', count: 3 },
      { date: '2026-07-11', totalAmount: '30.00', count: 1 },
    ];
    expect(detectHighConcentrationDays(dayGroups)).toEqual(['2026-07-10']);
  });

  test('sin pagos no marca ningún día', () => {
    expect(detectHighConcentrationDays([{ date: '2026-07-10', totalAmount: '0.00', count: 0 }])).toEqual([]);
  });

  test('días parejos no marcan ninguno como de alta concentración', () => {
    const dayGroups = [
      { date: '2026-07-10', totalAmount: '100.00', count: 1 },
      { date: '2026-07-11', totalAmount: '110.00', count: 1 },
      { date: '2026-07-12', totalAmount: '90.00', count: 1 },
    ];
    expect(detectHighConcentrationDays(dayGroups)).toEqual([]);
  });
});
