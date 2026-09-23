const { isDue } = require('./scheduled-reports.rules');

describe('isDue', () => {
  test('nunca corrido antes → siempre vencido', () => {
    expect(isDue('DAILY', null, new Date('2026-07-13'))).toBe(true);
  });

  test('DAILY: vencido si pasó 1 día o más', () => {
    const lastRun = new Date('2026-07-12T00:00:00Z');
    expect(isDue('DAILY', lastRun, new Date('2026-07-12T23:00:00Z'))).toBe(false);
    expect(isDue('DAILY', lastRun, new Date('2026-07-13T00:00:00Z'))).toBe(true);
  });

  test('WEEKLY: vencido si pasaron 7 días o más', () => {
    const lastRun = new Date('2026-07-01T00:00:00Z');
    expect(isDue('WEEKLY', lastRun, new Date('2026-07-07T00:00:00Z'))).toBe(false);
    expect(isDue('WEEKLY', lastRun, new Date('2026-07-08T00:00:00Z'))).toBe(true);
  });

  test('MONTHLY: vencido si pasaron 28 días o más', () => {
    const lastRun = new Date('2026-06-01T00:00:00Z');
    expect(isDue('MONTHLY', lastRun, new Date('2026-06-20T00:00:00Z'))).toBe(false);
    expect(isDue('MONTHLY', lastRun, new Date('2026-06-29T00:00:00Z'))).toBe(true);
  });
});
