const { computeSyncStatus, isDisconnected } = require('./bank-sync.rules');

describe('bank-sync.rules', () => {
  const now = new Date('2026-07-20T12:00:00.000Z');

  test('sin ninguna importación previa, es RED', () => {
    expect(computeSyncStatus(null, now)).toBe('RED');
  });

  test('importado hace 2 horas, es GREEN', () => {
    const lastImportAt = new Date('2026-07-20T10:00:00.000Z');
    expect(computeSyncStatus(lastImportAt, now)).toBe('GREEN');
  });

  test('justo antes de las 24 horas, sigue GREEN', () => {
    const lastImportAt = new Date('2026-07-19T12:01:00.000Z');
    expect(computeSyncStatus(lastImportAt, now)).toBe('GREEN');
  });

  test('importado hace 30 horas, es YELLOW', () => {
    const lastImportAt = new Date('2026-07-19T06:00:00.000Z');
    expect(computeSyncStatus(lastImportAt, now)).toBe('YELLOW');
  });

  test('justo antes de las 48 horas, sigue YELLOW', () => {
    const lastImportAt = new Date('2026-07-18T12:01:00.000Z');
    expect(computeSyncStatus(lastImportAt, now)).toBe('YELLOW');
  });

  test('importado hace exactamente 48 horas o más, es RED', () => {
    const lastImportAt = new Date('2026-07-18T12:00:00.000Z');
    expect(computeSyncStatus(lastImportAt, now)).toBe('RED');
  });

  test('importado hace varios días, es RED', () => {
    const lastImportAt = new Date('2026-07-10T12:00:00.000Z');
    expect(computeSyncStatus(lastImportAt, now)).toBe('RED');
  });

  test('isDisconnected refleja exactamente el estado RED', () => {
    expect(isDisconnected(null, now)).toBe(true);
    expect(isDisconnected(new Date('2026-07-20T10:00:00.000Z'), now)).toBe(false);
    expect(isDisconnected(new Date('2026-07-18T11:00:00.000Z'), now)).toBe(true);
  });
});
