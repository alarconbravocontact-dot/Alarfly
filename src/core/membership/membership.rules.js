// Funciones puras: derivan el estado EFECTIVO de una membresía a partir
// de datos reales (nunca inventan un estado nuevo, nunca dependen de la
// hora exacta en que se llaman más allá de "ahora").

const MANUAL_PAYMENT_METHODS = ['ZELLE', 'PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE', 'OTRO'];

// `trialEndsAt` viene de Company (un solo dueño de la verdad por dato,
// ver schema.prisma) — esta función nunca la guarda, solo la lee.
function computeEffectiveStatus(membership, trialEndsAt, now = new Date()) {
  if (membership.status === 'CANCELLED') return 'CANCELLED';

  if (membership.status === 'ACTIVE') {
    if (membership.currentPeriodEnd && new Date(membership.currentPeriodEnd) < now) {
      return 'PAST_DUE';
    }
    return 'ACTIVE';
  }

  if (membership.status === 'TRIALING') {
    if (trialEndsAt && new Date(trialEndsAt) < now) {
      return 'PAST_DUE';
    }
    return 'TRIALING';
  }

  // PENDING_PAYMENT y PAST_DUE no se reevalúan solos hacia atrás: solo
  // una decisión explícita (confirmar/rechazar un pago) los cambia.
  return membership.status;
}

function daysUntil(date, now = new Date()) {
  if (!date) return null;
  const diffMs = new Date(date).getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// Quién puede enviar/decidir un pago de membresía de SU PROPIA empresa.
function assertCanManageMembership(role) {
  return role === 'ADMIN';
}

// Un pago solo tiene sentido pedirlo si la membresía no está ya activa
// con un período vigente, ni cancelada.
function assertCanSubmitPayment(effectiveStatus) {
  return effectiveStatus === 'TRIALING' || effectiveStatus === 'PAST_DUE' || effectiveStatus === 'PENDING_PAYMENT';
}

module.exports = {
  MANUAL_PAYMENT_METHODS,
  computeEffectiveStatus,
  daysUntil,
  assertCanManageMembership,
  assertCanSubmitPayment,
};
