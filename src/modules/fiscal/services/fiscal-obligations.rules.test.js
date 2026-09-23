const { calculateNextDueDate } = require('./fiscal-obligations.rules');

function iso(date) {
  return date.toISOString().slice(0, 10);
}

describe('calculateNextDueDate (calendario fiscal)', () => {
  test('MONTHLY: si el día del mes todavía no pasó, vence este mes', () => {
    const obligation = { recurrence: 'MONTHLY', dueDayOfMonth: 20 };
    expect(iso(calculateNextDueDate(obligation, new Date('2026-07-13')))).toBe('2026-07-20');
  });

  test('MONTHLY: si el día del mes ya pasó, vence el mes siguiente', () => {
    const obligation = { recurrence: 'MONTHLY', dueDayOfMonth: 5 };
    expect(iso(calculateNextDueDate(obligation, new Date('2026-07-13')))).toBe('2026-08-05');
  });

  test('ANNUAL: vence en el mes/día configurado del mismo año si no ha pasado', () => {
    const obligation = { recurrence: 'ANNUAL', dueDayOfMonth: 30, dueMonth: 12 };
    expect(iso(calculateNextDueDate(obligation, new Date('2026-07-13')))).toBe('2026-12-30');
  });

  test('ANNUAL: si ya pasó este año, vence el año siguiente', () => {
    const obligation = { recurrence: 'ANNUAL', dueDayOfMonth: 15, dueMonth: 3 };
    expect(iso(calculateNextDueDate(obligation, new Date('2026-07-13')))).toBe('2027-03-15');
  });

  test('ANNUAL sin dueMonth rechaza', () => {
    expect(() => calculateNextDueDate({ recurrence: 'ANNUAL', dueDayOfMonth: 10 }, new Date('2026-07-13'))).toThrow(
      'dueMonth'
    );
  });

  test('BIMONTHLY: recurre cada 2 meses con la paridad de dueMonth (meses impares)', () => {
    const obligation = { recurrence: 'BIMONTHLY', dueDayOfMonth: 10, dueMonth: 1 };
    expect(iso(calculateNextDueDate(obligation, new Date('2026-07-13')))).toBe('2026-09-10');
    expect(iso(calculateNextDueDate(obligation, new Date('2026-01-05')))).toBe('2026-01-10');
  });

  test('BIMONTHLY: paridad de meses pares', () => {
    const obligation = { recurrence: 'BIMONTHLY', dueDayOfMonth: 15, dueMonth: 2 };
    expect(iso(calculateNextDueDate(obligation, new Date('2026-07-13')))).toBe('2026-08-15');
  });

  test('rechaza un día de vencimiento fuera de rango', () => {
    expect(() => calculateNextDueDate({ recurrence: 'MONTHLY', dueDayOfMonth: 35 }, new Date())).toThrow('entre 1 y 31');
  });

  test('rechaza una recurrencia no soportada', () => {
    expect(() => calculateNextDueDate({ recurrence: 'WEEKLY', dueDayOfMonth: 10 }, new Date())).toThrow('no soportada');
  });
});
