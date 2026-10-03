const { Prisma } = require('@prisma/client');

// Funciones puras del módulo de Afiliados (Fase Afiliados) — sin
// acceso a base de datos, mismo criterio que el resto del proyecto
// (ej. period-lock.rules.js/payment-approval.rules.js): la regla de
// negocio se puede probar sola, sin levantar Postgres.

// Un código de afiliado nunca sale de la nada: se arma a partir de
// bytes aleatorios reales (crypto.randomBytes, en el servicio) y esta
// función solo les da la forma final — separado para poder probar el
// formato sin depender de aleatoriedad real en el test.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I, para que no se confundan al transcribir a mano
function buildCodeFromBytes(bytes) {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `AF-${code}`;
}

// Autorreferido: el propio afiliado no puede cobrar comisión por
// registrarse a sí mismo. Comparación por correo, insensible a
// mayúsculas (mismo criterio que Prisma usa con `email` en el resto
// del proyecto, donde el correo siempre se guarda ya normalizado).
function isSelfReferral(affiliateEmail, signupEmail) {
  if (!affiliateEmail || !signupEmail) return false;
  return affiliateEmail.trim().toLowerCase() === signupEmail.trim().toLowerCase();
}

// Snapshot de AffiliateProgramSettings → los 4 campos que se graban
// tal cual en la comisión, para que un cambio de tasa futuro nunca
// altere una comisión ya generada (mismo criterio que la tasa BCV en
// ArPayment, ya usado en el proyecto).
function computeCommissionAmount(settings) {
  const rateValue = new Prisma.Decimal(settings.rateValue);
  const referenceAmount = new Prisma.Decimal(settings.referenceAmount);
  const amount = settings.rateType === 'PERCENTAGE' ? referenceAmount.mul(rateValue).div(100) : rateValue;

  return {
    baseAmount: referenceAmount,
    rateType: settings.rateType,
    rateValue,
    amount,
    currency: settings.currency,
  };
}

// Transiciones de estado permitidas — mismo criterio que
// period-lock/budget.rules.js (función pura `assertCanTransition`):
// un mapa explícito, nunca "cualquier estado puede ir a cualquier
// otro". PAID y CANCELLED son terminales (ninguna salida).
const ALLOWED_COMMISSION_TRANSITIONS = {
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PAYABLE', 'CANCELLED'],
  PAYABLE: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

function assertCanTransitionCommission(fromStatus, toStatus) {
  const allowed = ALLOWED_COMMISSION_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error(`No se puede pasar una comisión de "${fromStatus}" a "${toStatus}".`);
  }
}

module.exports = {
  CODE_ALPHABET,
  buildCodeFromBytes,
  isSelfReferral,
  computeCommissionAmount,
  ALLOWED_COMMISSION_TRANSITIONS,
  assertCanTransitionCommission,
};
