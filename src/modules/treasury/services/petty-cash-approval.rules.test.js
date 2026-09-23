const { assertCanApproveExpense, needsReplenishment } = require('./petty-cash-approval.rules');
const AppError = require('../../../core/utils/AppError');

describe('assertCanApproveExpense (maker-checker de caja chica)', () => {
  const pendingExpense = { status: 'PENDING_APPROVAL', registeredByUserId: 'empleado1' };

  test('permite aprobar cuando el supervisor es distinto de quien registró el gasto', () => {
    expect(() =>
      assertCanApproveExpense({ expense: pendingExpense, approverUserId: 'supervisor1', approverRole: 'ADMIN' })
    ).not.toThrow();
  });

  test('bloquea que el mismo empleado que registró el gasto lo apruebe', () => {
    expect(() =>
      assertCanApproveExpense({ expense: pendingExpense, approverUserId: 'empleado1', approverRole: 'ADMIN' })
    ).toThrow(AppError);
    expect(() =>
      assertCanApproveExpense({ expense: pendingExpense, approverUserId: 'empleado1', approverRole: 'ADMIN' })
    ).toThrow(/maker-checker/);
  });

  test('rechaza si el gasto no está pendiente de aprobación', () => {
    expect(() =>
      assertCanApproveExpense({
        expense: { ...pendingExpense, status: 'APPROVED' },
        approverUserId: 'supervisor1',
        approverRole: 'ADMIN',
      })
    ).toThrow(/no está pendiente/);
  });

  test('rechaza si el rol del aprobador no es de supervisión', () => {
    expect(() =>
      assertCanApproveExpense({ expense: pendingExpense, approverUserId: 'supervisor1', approverRole: 'ACCOUNTANT' })
    ).toThrow(/no tiene permiso/);
  });
});

describe('needsReplenishment', () => {
  test('detecta cuando el saldo cae por debajo del umbral', () => {
    expect(needsReplenishment({ currentBalance: 40, replenishmentThreshold: 50 })).toBe(true);
  });

  test('no marca reposición si el saldo está en o por encima del umbral', () => {
    expect(needsReplenishment({ currentBalance: 50, replenishmentThreshold: 50 })).toBe(false);
    expect(needsReplenishment({ currentBalance: 100, replenishmentThreshold: 50 })).toBe(false);
  });
});
