const { assertCanDecide, assertCanReimburse } = require('./employee-expenses.rules');

describe('employee-expenses.rules', () => {
  describe('assertCanDecide', () => {
    it('permite decidir (aprobar/rechazar) un gasto pendiente, por otro usuario', () => {
      const expense = { status: 'PENDING_APPROVAL', registeredByUserId: 'u1' };
      expect(() => assertCanDecide(expense, 'u2')).not.toThrow();
    });

    it('rechaza decidir un gasto que no está pendiente', () => {
      const expense = { status: 'APPROVED', registeredByUserId: 'u1' };
      expect(() => assertCanDecide(expense, 'u2')).toThrow('no está pendiente de aprobación');
    });

    it('rechaza maker-checker: quien registró no puede decidir su propio gasto', () => {
      const expense = { status: 'PENDING_APPROVAL', registeredByUserId: 'u1' };
      expect(() => assertCanDecide(expense, 'u1')).toThrow('no puede aprobarlo o rechazarlo');
    });
  });

  describe('assertCanReimburse', () => {
    it('permite reembolsar un gasto ya aprobado', () => {
      expect(() => assertCanReimburse({ status: 'APPROVED' })).not.toThrow();
    });

    it('rechaza reembolsar un gasto pendiente o rechazado', () => {
      expect(() => assertCanReimburse({ status: 'PENDING_APPROVAL' })).toThrow('ya aprobados');
      expect(() => assertCanReimburse({ status: 'REJECTED' })).toThrow('ya aprobados');
    });

    it('rechaza reembolsar un gasto ya reembolsado (no se puede dos veces)', () => {
      expect(() => assertCanReimburse({ status: 'REIMBURSED' })).toThrow('ya aprobados');
    });
  });
});
