const {
  computeEffectiveStatus,
  daysUntil,
  assertCanManageMembership,
  assertCanSubmitPayment,
} = require('./membership.rules');

describe('computeEffectiveStatus', () => {
  const now = new Date('2026-10-08T00:00:00Z');

  test('CANCELLED se queda cancelada sin importar nada más', () => {
    expect(computeEffectiveStatus({ status: 'CANCELLED' }, null, now)).toBe('CANCELLED');
  });

  test('ACTIVE con período vigente sigue ACTIVE', () => {
    const membership = { status: 'ACTIVE', currentPeriodEnd: '2026-11-01T00:00:00Z' };
    expect(computeEffectiveStatus(membership, null, now)).toBe('ACTIVE');
  });

  test('ACTIVE con período ya vencido pasa a PAST_DUE', () => {
    const membership = { status: 'ACTIVE', currentPeriodEnd: '2026-09-01T00:00:00Z' };
    expect(computeEffectiveStatus(membership, null, now)).toBe('PAST_DUE');
  });

  test('TRIALING con trialEndsAt futuro sigue TRIALING', () => {
    const membership = { status: 'TRIALING' };
    expect(computeEffectiveStatus(membership, '2026-10-15T00:00:00Z', now)).toBe('TRIALING');
  });

  test('TRIALING con trialEndsAt ya pasado pasa a PAST_DUE', () => {
    const membership = { status: 'TRIALING' };
    expect(computeEffectiveStatus(membership, '2026-10-01T00:00:00Z', now)).toBe('PAST_DUE');
  });

  test('TRIALING sin trialEndsAt (empresa antigua, sin prueba) se queda TRIALING', () => {
    const membership = { status: 'TRIALING' };
    expect(computeEffectiveStatus(membership, null, now)).toBe('TRIALING');
  });

  test('PENDING_PAYMENT no se reevalúa solo — se queda igual hasta una decisión explícita', () => {
    const membership = { status: 'PENDING_PAYMENT' };
    expect(computeEffectiveStatus(membership, '2026-01-01T00:00:00Z', now)).toBe('PENDING_PAYMENT');
  });

  test('PAST_DUE no se reevalúa solo', () => {
    const membership = { status: 'PAST_DUE' };
    expect(computeEffectiveStatus(membership, null, now)).toBe('PAST_DUE');
  });
});

describe('daysUntil', () => {
  test('null si no hay fecha', () => {
    expect(daysUntil(null)).toBeNull();
  });

  test('cuenta los días exactos hacia adelante', () => {
    const now = new Date('2026-10-08T00:00:00Z');
    expect(daysUntil('2026-10-15T00:00:00Z', now)).toBe(7);
  });

  test('negativo si la fecha ya pasó', () => {
    const now = new Date('2026-10-08T00:00:00Z');
    expect(daysUntil('2026-10-01T00:00:00Z', now)).toBeLessThan(0);
  });
});

describe('assertCanManageMembership', () => {
  test('solo ADMIN puede gestionar la membresía de su empresa', () => {
    expect(assertCanManageMembership('ADMIN')).toBe(true);
    expect(assertCanManageMembership('ACCOUNTANT')).toBe(false);
    expect(assertCanManageMembership('FINANCE')).toBe(false);
    expect(assertCanManageMembership('COLLABORATOR')).toBe(false);
  });
});

describe('assertCanSubmitPayment', () => {
  test('permite enviar comprobante en prueba, vencida o ya con un pago pendiente', () => {
    expect(assertCanSubmitPayment('TRIALING')).toBe(true);
    expect(assertCanSubmitPayment('PAST_DUE')).toBe(true);
    expect(assertCanSubmitPayment('PENDING_PAYMENT')).toBe(true);
  });

  test('rechaza si ya está activa o cancelada', () => {
    expect(assertCanSubmitPayment('ACTIVE')).toBe(false);
    expect(assertCanSubmitPayment('CANCELLED')).toBe(false);
  });
});
