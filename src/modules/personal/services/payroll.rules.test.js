const { Prisma } = require('@prisma/client');
const {
  assertCanTransition,
  assertEditable,
  computeItemTotals,
  computePayrollTotals,
  sumBreakdown,
} = require('./payroll.rules');

const { Decimal } = Prisma;

describe('payroll.rules', () => {
  describe('assertCanTransition', () => {
    it('permite el camino feliz completo', () => {
      expect(() => assertCanTransition('DRAFT', 'CALCULATED')).not.toThrow();
      expect(() => assertCanTransition('CALCULATED', 'REVIEWED')).not.toThrow();
      expect(() => assertCanTransition('REVIEWED', 'APPROVED')).not.toThrow();
      expect(() => assertCanTransition('APPROVED', 'PAID')).not.toThrow();
    });

    it('permite rebotar de Calculada a Borrador y de Revisada a Calculada', () => {
      expect(() => assertCanTransition('CALCULATED', 'DRAFT')).not.toThrow();
      expect(() => assertCanTransition('REVIEWED', 'CALCULATED')).not.toThrow();
    });

    it('rechaza saltarse pasos (Borrador directo a Aprobada)', () => {
      expect(() => assertCanTransition('DRAFT', 'APPROVED')).toThrow('No se puede pasar una nómina');
    });

    it('rechaza cualquier transición desde Pagada (estado terminal)', () => {
      expect(() => assertCanTransition('PAID', 'DRAFT')).toThrow(/No se puede pasar/);
      expect(() => assertCanTransition('PAID', 'APPROVED')).toThrow(/No se puede pasar/);
    });
  });

  describe('assertEditable', () => {
    it('permite editar en Borrador y Calculada', () => {
      expect(() => assertEditable('DRAFT')).not.toThrow();
      expect(() => assertEditable('CALCULATED')).not.toThrow();
    });

    it('rechaza editar desde Revisada en adelante', () => {
      expect(() => assertEditable('REVIEWED')).toThrow('ya no se puede editar');
      expect(() => assertEditable('APPROVED')).toThrow('ya no se puede editar');
      expect(() => assertEditable('PAID')).toThrow('ya no se puede editar');
    });
  });

  describe('sumBreakdown', () => {
    it('suma los montos de un arreglo de conceptos', () => {
      const total = sumBreakdown([{ label: 'Bono', amount: 50 }, { label: 'Comisión', amount: 25.5 }]);
      expect(total.toString()).toBe('75.5');
    });

    it('devuelve 0 si el desglose está vacío, es null o no es un arreglo', () => {
      expect(sumBreakdown([]).toString()).toBe('0');
      expect(sumBreakdown(null).toString()).toBe('0');
      expect(sumBreakdown(undefined).toString()).toBe('0');
    });
  });

  describe('computeItemTotals', () => {
    it('calcula ingresos, deducciones y neto de una línea', () => {
      const result = computeItemTotals(
        1000,
        [{ label: 'Bono', amount: 100 }],
        [{ label: 'Préstamo', amount: 50 }]
      );
      expect(result.totalIncome.toString()).toBe('1100');
      expect(result.totalDeductions.toString()).toBe('50');
      expect(result.netPay.toString()).toBe('1050');
    });

    it('funciona solo con salario base, sin ningún concepto adicional', () => {
      const result = computeItemTotals(800, null, null);
      expect(result.totalIncome.toString()).toBe('800');
      expect(result.totalDeductions.toString()).toBe('0');
      expect(result.netPay.toString()).toBe('800');
    });

    it('rechaza un neto negativo (deducciones mayores al ingreso)', () => {
      expect(() => computeItemTotals(100, [], [{ label: 'Descuento excesivo', amount: 150 }])).toThrow(
        'Las deducciones no pueden superar'
      );
    });
  });

  describe('computePayrollTotals', () => {
    it('agrega los totales de varias líneas (varios empleados)', () => {
      const items = [
        { totalIncome: new Decimal(1000), totalDeductions: new Decimal(50), netPay: new Decimal(950) },
        { totalIncome: new Decimal(1200), totalDeductions: new Decimal(0), netPay: new Decimal(1200) },
      ];
      const totals = computePayrollTotals(items);
      expect(totals.totalIncome.toString()).toBe('2200');
      expect(totals.totalDeductions.toString()).toBe('50');
      expect(totals.netTotal.toString()).toBe('2150');
    });

    it('devuelve ceros con una nómina sin líneas (todavía sin empleados calculados)', () => {
      const totals = computePayrollTotals([]);
      expect(totals.totalIncome.toString()).toBe('0');
      expect(totals.totalDeductions.toString()).toBe('0');
      expect(totals.netTotal.toString()).toBe('0');
    });
  });
});
