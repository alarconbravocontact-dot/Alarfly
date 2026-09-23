const { daysOverdue, classifyAgingBucket, buildAgingReport } = require('./aging.rules');

describe('daysOverdue', () => {
  test('positivo si ya venció', () => {
    expect(daysOverdue(new Date('2026-07-01'), new Date('2026-07-15'))).toBe(14);
  });
  test('negativo si todavía no vence', () => {
    expect(daysOverdue(new Date('2026-08-01'), new Date('2026-07-15'))).toBe(-17);
  });
});

describe('classifyAgingBucket', () => {
  test('CURRENT si no vencido', () => {
    expect(classifyAgingBucket(0)).toBe('CURRENT');
    expect(classifyAgingBucket(-5)).toBe('CURRENT');
  });
  test('DAYS_1_30', () => {
    expect(classifyAgingBucket(1)).toBe('DAYS_1_30');
    expect(classifyAgingBucket(30)).toBe('DAYS_1_30');
  });
  test('DAYS_31_60', () => {
    expect(classifyAgingBucket(31)).toBe('DAYS_31_60');
    expect(classifyAgingBucket(60)).toBe('DAYS_31_60');
  });
  test('DAYS_61_90', () => {
    expect(classifyAgingBucket(61)).toBe('DAYS_61_90');
    expect(classifyAgingBucket(90)).toBe('DAYS_61_90');
  });
  test('DAYS_90_PLUS', () => {
    expect(classifyAgingBucket(91)).toBe('DAYS_90_PLUS');
    expect(classifyAgingBucket(400)).toBe('DAYS_90_PLUS');
  });
});

describe('buildAgingReport', () => {
  test('agrupa saldos abiertos por balde y calcula totales', () => {
    const asOfDate = new Date('2026-07-15');
    const items = [
      { id: '1', name: 'Cliente A', dueDate: new Date('2026-07-20'), balance: 100 }, // CURRENT
      { id: '2', name: 'Cliente B', dueDate: new Date('2026-07-01'), balance: 200 }, // 14 días -> DAYS_1_30
      { id: '3', name: 'Cliente C', dueDate: new Date('2026-05-01'), balance: 50 }, // ~75 días -> DAYS_61_90
    ];
    const report = buildAgingReport(items, asOfDate);

    expect(report.rows[0].bucket).toBe('CURRENT');
    expect(report.rows[1].bucket).toBe('DAYS_1_30');
    expect(report.rows[2].bucket).toBe('DAYS_61_90');
    expect(report.totalsByBucket.CURRENT).toBe('100.00');
    expect(report.totalsByBucket.DAYS_1_30).toBe('200.00');
    expect(report.totalsByBucket.DAYS_61_90).toBe('50.00');
    expect(report.totalOutstanding).toBe('350.00');
  });

  test('reporte vacío da totales en cero, no revienta', () => {
    const report = buildAgingReport([], new Date('2026-07-15'));
    expect(report.totalOutstanding).toBe('0.00');
  });
});
