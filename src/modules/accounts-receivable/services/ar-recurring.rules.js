const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

const MIN_MONTHLY_GAP_DAYS = 25;
const MAX_MONTHLY_GAP_DAYS = 35;
const MIN_OCCURRENCES_FOR_PATTERN = 3; // la factura actual + 2 anteriores

function daysBetween(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (24 * 60 * 60 * 1000);
}

// Función pura: detecta si una factura (la que se va a duplicar) forma
// parte de un patrón real de recurrencia mensual — mismo cliente, mismo
// monto exacto, con al menos 2 facturas anteriores espaciadas ~30 días
// entre sí y respecto a ella. Nunca asume: si no hay suficiente
// historial que calce, no sugiere nada — mejor no sugerir que sugerir
// mal (innovación pedida explícitamente por el usuario para la acción
// "Duplicar").
function detectRecurringPattern(candidate, sameCustomerInvoices) {
  const candidateAmount = new Decimal(candidate.totalAmount);
  const candidateDate = new Date(candidate.issueDate);

  const matchingPrior = sameCustomerInvoices
    .filter(
      (inv) =>
        inv.id !== candidate.id &&
        new Decimal(inv.totalAmount).equals(candidateAmount) &&
        new Date(inv.issueDate).getTime() < candidateDate.getTime()
    )
    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

  const chain = [{ id: candidate.id, issueDate: candidateDate }];
  let cursor = candidateDate;
  for (const inv of matchingPrior) {
    const gap = daysBetween(cursor, inv.issueDate);
    if (gap < MIN_MONTHLY_GAP_DAYS || gap > MAX_MONTHLY_GAP_DAYS) break;
    chain.push(inv);
    cursor = new Date(inv.issueDate);
  }

  if (chain.length < MIN_OCCURRENCES_FOR_PATTERN) {
    return { isRecurring: false, occurrences: chain.length };
  }

  return {
    isRecurring: true,
    occurrences: chain.length,
    amount: candidateAmount.toFixed(2),
  };
}

module.exports = {
  detectRecurringPattern,
  MIN_MONTHLY_GAP_DAYS,
  MAX_MONTHLY_GAP_DAYS,
  MIN_OCCURRENCES_FOR_PATTERN,
};
