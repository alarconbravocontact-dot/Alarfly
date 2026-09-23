const { findMatchingRule, assertCanApprove, nextApprovalLevel, isFullyApproved } = require('./payment-approval.rules');
const AppError = require('../../../core/utils/AppError');

describe('findMatchingRule', () => {
  const rules = [
    { id: 'r1', isActive: true, minAmount: 0, maxAmount: 999.99 },
    { id: 'r2', isActive: true, minAmount: 1000, maxAmount: 9999.99 },
    { id: 'r3', isActive: true, minAmount: 10000, maxAmount: null },
  ];

  test('elige el rango correcto para un monto chico', () => {
    expect(findMatchingRule(rules, 500).id).toBe('r1');
  });

  test('elige el rango correcto para un monto grande sin tope', () => {
    expect(findMatchingRule(rules, 50000).id).toBe('r3');
  });

  test('devuelve null si ningún rango cubre el monto', () => {
    // hueco a propósito entre reglas para probar el caso "sin regla"
    const withGap = [{ id: 'r1', isActive: true, minAmount: 0, maxAmount: 100 }];
    expect(findMatchingRule(withGap, 500)).toBeNull();
  });

  test('ignora reglas inactivas', () => {
    const withInactive = [{ id: 'r1', isActive: false, minAmount: 0, maxAmount: null }];
    expect(findMatchingRule(withInactive, 500)).toBeNull();
  });

  test('prefiere el rango más angosto si se cruzan dos reglas', () => {
    const overlapping = [
      { id: 'wide', isActive: true, minAmount: 0, maxAmount: null },
      { id: 'narrow', isActive: true, minAmount: 100, maxAmount: 200 },
    ];
    expect(findMatchingRule(overlapping, 150).id).toBe('narrow');
  });
});

describe('assertCanApprove (flujo de aprobación multinivel)', () => {
  const baseOrder = { status: 'PENDING_APPROVAL', requiredLevels: 2, createdByUserId: 'maker' };

  test('permite aprobar cuando todo está en regla', () => {
    expect(() =>
      assertCanApprove({
        order: baseOrder,
        existingApprovals: [],
        level: 1,
        allowedRolesForLevel: ['ACCOUNTANT'],
        approverUserId: 'checker1',
        approverRole: 'ACCOUNTANT',
      })
    ).not.toThrow();
  });

  test('rechaza si la orden no está pendiente de aprobación', () => {
    expect(() =>
      assertCanApprove({
        order: { ...baseOrder, status: 'APPROVED' },
        existingApprovals: [],
        level: 1,
        allowedRolesForLevel: ['ACCOUNTANT'],
        approverUserId: 'checker1',
        approverRole: 'ACCOUNTANT',
      })
    ).toThrow(AppError);
  });

  test('bloquea que quien creó la orden la apruebe (maker-checker)', () => {
    expect(() =>
      assertCanApprove({
        order: baseOrder,
        existingApprovals: [],
        level: 1,
        allowedRolesForLevel: ['ADMIN', 'ACCOUNTANT'],
        approverUserId: 'maker',
        approverRole: 'ACCOUNTANT',
      })
    ).toThrow(/no puede aprobarla/);
  });

  test('bloquea que el mismo aprobador firme dos niveles de la misma orden', () => {
    expect(() =>
      assertCanApprove({
        order: baseOrder,
        existingApprovals: [{ approvedByUserId: 'checker1', level: 1 }],
        level: 2,
        allowedRolesForLevel: ['APPROVER'],
        approverUserId: 'checker1',
        approverRole: 'APPROVER',
      })
    ).toThrow(/nivel anterior/);
  });

  test('rechaza si el rol del aprobador no está permitido en ese nivel', () => {
    expect(() =>
      assertCanApprove({
        order: baseOrder,
        existingApprovals: [],
        level: 1,
        allowedRolesForLevel: ['APPROVER'],
        approverUserId: 'checker1',
        approverRole: 'VIEWER',
      })
    ).toThrow(/tu rol/i);
  });

  test('rechaza si ya se completaron todos los niveles requeridos', () => {
    expect(() =>
      assertCanApprove({
        order: baseOrder,
        existingApprovals: [{ approvedByUserId: 'a' }, { approvedByUserId: 'b' }],
        level: 3,
        allowedRolesForLevel: ['ADMIN'],
        approverUserId: 'checker3',
        approverRole: 'ADMIN',
      })
    ).toThrow(/completó todos sus niveles/);
  });
});

describe('nextApprovalLevel / isFullyApproved', () => {
  test('el siguiente nivel es uno más que las aprobaciones ya dadas', () => {
    expect(nextApprovalLevel([])).toBe(1);
    expect(nextApprovalLevel([{}, {}])).toBe(3);
  });

  test('detecta cuándo se completó el último nivel requerido', () => {
    expect(isFullyApproved(2, 2)).toBe(true);
    expect(isFullyApproved(1, 2)).toBe(false);
  });
});
