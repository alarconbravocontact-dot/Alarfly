const { detectRecurringPattern } = require('./ar-recurring.rules');

describe('detectRecurringPattern', () => {
  test('detecta un patrón mensual real: mismo monto, 3 facturas espaciadas ~30 días', () => {
    const candidate = { id: 'inv3', totalAmount: '500.00', issueDate: '2026-07-15T00:00:00Z' };
    const history = [
      { id: 'inv1', totalAmount: '500.00', issueDate: '2026-05-16T00:00:00Z' },
      { id: 'inv2', totalAmount: '500.00', issueDate: '2026-06-15T00:00:00Z' },
    ];
    const result = detectRecurringPattern(candidate, history);
    expect(result.isRecurring).toBe(true);
    expect(result.occurrences).toBe(3);
    expect(result.amount).toBe('500.00');
  });

  test('no sugiere nada con una sola factura anterior (historial insuficiente)', () => {
    const candidate = { id: 'inv2', totalAmount: '500.00', issueDate: '2026-07-15T00:00:00Z' };
    const history = [{ id: 'inv1', totalAmount: '500.00', issueDate: '2026-06-15T00:00:00Z' }];
    const result = detectRecurringPattern(candidate, history);
    expect(result.isRecurring).toBe(false);
    expect(result.occurrences).toBe(2);
  });

  test('no sugiere nada si el monto no coincide exactamente', () => {
    const candidate = { id: 'inv3', totalAmount: '500.00', issueDate: '2026-07-15T00:00:00Z' };
    const history = [
      { id: 'inv1', totalAmount: '500.00', issueDate: '2026-05-16T00:00:00Z' },
      { id: 'inv2', totalAmount: '480.00', issueDate: '2026-06-15T00:00:00Z' },
    ];
    const result = detectRecurringPattern(candidate, history);
    expect(result.isRecurring).toBe(false);
    // inv2 queda fuera por monto distinto; inv1 sí calza en monto, pero al
    // faltar el eslabón intermedio (inv2) queda a 60 días del candidato,
    // demasiado lejos para contar como el mismo patrón mensual.
    expect(result.occurrences).toBe(1);
  });

  test('no sugiere nada si el espaciado no es mensual (ej. facturas semanales)', () => {
    const candidate = { id: 'inv3', totalAmount: '500.00', issueDate: '2026-07-15T00:00:00Z' };
    const history = [
      { id: 'inv1', totalAmount: '500.00', issueDate: '2026-07-01T00:00:00Z' },
      { id: 'inv2', totalAmount: '500.00', issueDate: '2026-07-08T00:00:00Z' },
    ];
    const result = detectRecurringPattern(candidate, history);
    expect(result.isRecurring).toBe(false);
  });

  test('corta la cadena en el primer salto que no calza, aunque haya más facturas antiguas', () => {
    const candidate = { id: 'inv4', totalAmount: '500.00', issueDate: '2026-08-15T00:00:00Z' };
    const history = [
      { id: 'inv1', totalAmount: '500.00', issueDate: '2026-01-15T00:00:00Z' }, // muy lejos de inv2, no debería contar
      { id: 'inv2', totalAmount: '500.00', issueDate: '2026-07-16T00:00:00Z' },
      { id: 'inv3', totalAmount: '500.00', issueDate: '2026-06-15T00:00:00Z' },
    ];
    const result = detectRecurringPattern(candidate, history);
    expect(result.isRecurring).toBe(true);
    expect(result.occurrences).toBe(3); // candidate + inv2 + inv3, sin inv1
  });

  test('ignora la propia factura candidata si aparece en el historial', () => {
    const candidate = { id: 'inv1', totalAmount: '500.00', issueDate: '2026-07-15T00:00:00Z' };
    const history = [{ id: 'inv1', totalAmount: '500.00', issueDate: '2026-07-15T00:00:00Z' }];
    const result = detectRecurringPattern(candidate, history);
    expect(result.isRecurring).toBe(false);
    expect(result.occurrences).toBe(1);
  });
});
