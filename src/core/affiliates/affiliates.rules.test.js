const { Prisma } = require('@prisma/client');
const {
  buildCodeFromBytes,
  isSelfReferral,
  computeCommissionAmount,
  assertCanTransitionCommission,
} = require('./affiliates.rules');

describe('affiliates.rules', () => {
  describe('buildCodeFromBytes', () => {
    test('arma un código con el prefijo AF- y 6 caracteres del alfabeto permitido', () => {
      const code = buildCodeFromBytes(Buffer.from([0, 1, 2, 3, 4, 5]));
      expect(code).toMatch(/^AF-[A-Z2-9]{6}$/);
    });

    test('nunca produce 0, O, 1 ni I (se excluyen a propósito del alfabeto)', () => {
      // Recorre los 256 valores de byte posibles para una sola posición
      // y confirma que ninguno cae en un carácter prohibido.
      for (let b = 0; b < 256; b += 1) {
        const code = buildCodeFromBytes([b, b, b, b, b, b]);
        expect(code).not.toMatch(/[0O1I]/);
      }
    });

    test('es determinístico: los mismos bytes siempre dan el mismo código', () => {
      const bytes = [10, 20, 30, 40, 50, 60];
      expect(buildCodeFromBytes(bytes)).toBe(buildCodeFromBytes(bytes));
    });
  });

  describe('isSelfReferral', () => {
    test('detecta el mismo correo, insensible a mayúsculas y espacios', () => {
      expect(isSelfReferral('Ana@Correo.com', '  ana@correo.com  ')).toBe(true);
    });

    test('correos distintos no son autorreferido', () => {
      expect(isSelfReferral('ana@correo.com', 'otro@correo.com')).toBe(false);
    });

    test('nunca truena con valores faltantes', () => {
      expect(isSelfReferral(null, 'ana@correo.com')).toBe(false);
      expect(isSelfReferral('ana@correo.com', undefined)).toBe(false);
    });
  });

  describe('computeCommissionAmount', () => {
    test('FLAT: el monto es exactamente rateValue, sin importar referenceAmount', () => {
      const result = computeCommissionAmount({ rateType: 'FLAT', rateValue: 5, referenceAmount: 25, currency: 'USD' });
      expect(result.amount.toString()).toBe('5');
      expect(result.baseAmount.toString()).toBe('25');
      expect(result.currency).toBe('USD');
    });

    test('PERCENTAGE: el monto es el porcentaje de referenceAmount', () => {
      const result = computeCommissionAmount({ rateType: 'PERCENTAGE', rateValue: 20, referenceAmount: 25, currency: 'USD' });
      expect(result.amount.toString()).toBe('5'); // 20% de 25
    });

    test('PERCENTAGE con decimales no pierde precisión (usa Prisma.Decimal, no float)', () => {
      const result = computeCommissionAmount({ rateType: 'PERCENTAGE', rateValue: 33.33, referenceAmount: 10, currency: 'USD' });
      expect(result.amount).toBeInstanceOf(Prisma.Decimal);
      expect(result.amount.toFixed(4)).toBe('3.3330');
    });
  });

  describe('assertCanTransitionCommission', () => {
    test('permite las transiciones válidas del ciclo de vida', () => {
      expect(() => assertCanTransitionCommission('PENDING', 'APPROVED')).not.toThrow();
      expect(() => assertCanTransitionCommission('APPROVED', 'PAYABLE')).not.toThrow();
      expect(() => assertCanTransitionCommission('PAYABLE', 'PAID')).not.toThrow();
      expect(() => assertCanTransitionCommission('PENDING', 'CANCELLED')).not.toThrow();
    });

    test('rechaza saltarse pasos (PENDING directo a PAID)', () => {
      expect(() => assertCanTransitionCommission('PENDING', 'PAID')).toThrow();
    });

    test('rechaza cualquier transición desde un estado terminal', () => {
      expect(() => assertCanTransitionCommission('PAID', 'PENDING')).toThrow();
      expect(() => assertCanTransitionCommission('CANCELLED', 'APPROVED')).toThrow();
    });

    test('rechaza retroceder (APPROVED a PENDING)', () => {
      expect(() => assertCanTransitionCommission('APPROVED', 'PENDING')).toThrow();
    });
  });
});
