const { Prisma } = require('@prisma/client');
const { generateInstallmentSchedule } = require('./debt-schedule.rules');

const { Decimal } = Prisma;

describe('generateInstallmentSchedule (cronograma de cuotas, capital constante)', () => {
  test('genera el número de cuotas indicado, mensuales desde la fecha de inicio', () => {
    const schedule = generateInstallmentSchedule({
      principalAmount: 12000,
      interestRate: 12, // 12% anual = 1% mensual
      installmentCount: 12,
      startDate: '2026-01-15',
    });

    expect(schedule).toHaveLength(12);
    expect(schedule[0].dueDate.toISOString().slice(0, 10)).toBe('2026-02-15');
    expect(schedule[11].dueDate.toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  test('el capital de cada cuota es constante (excepto redondeo en la última)', () => {
    const schedule = generateInstallmentSchedule({
      principalAmount: 12000,
      interestRate: 12,
      installmentCount: 12,
      startDate: '2026-01-15',
    });

    for (let i = 0; i < 11; i++) {
      expect(schedule[i].principalPortion.toFixed(2)).toBe('1000.00');
    }
  });

  test('el interés baja en cada cuota porque el saldo restante baja', () => {
    const schedule = generateInstallmentSchedule({
      principalAmount: 12000,
      interestRate: 12,
      installmentCount: 12,
      startDate: '2026-01-15',
    });

    expect(schedule[0].interestPortion.greaterThan(schedule[1].interestPortion)).toBe(true);
    expect(schedule[1].interestPortion.greaterThan(schedule[2].interestPortion)).toBe(true);
  });

  test('la suma del capital de todas las cuotas es igual al principal (sin arrastrar centavos)', () => {
    const schedule = generateInstallmentSchedule({
      principalAmount: 10000,
      interestRate: 8.5,
      installmentCount: 7, // no divide exacto, fuerza redondeo
      startDate: '2026-03-01',
    });

    const totalPrincipal = schedule.reduce((sum, s) => sum.plus(s.principalPortion), new Decimal(0));
    expect(totalPrincipal.toFixed(2)).toBe('10000.00');
  });

  test('un préstamo sin interés (0%) no cobra interés en ninguna cuota', () => {
    const schedule = generateInstallmentSchedule({
      principalAmount: 6000,
      interestRate: 0,
      installmentCount: 6,
      startDate: '2026-01-01',
    });

    schedule.forEach((s) => expect(s.interestPortion.isZero()).toBe(true));
  });
});
