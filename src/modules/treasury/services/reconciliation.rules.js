const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(dateA, dateB) {
  return Math.round((new Date(dateA).getTime() - new Date(dateB).getTime()) / MS_PER_DAY);
}

// Función pura (sin base de datos): dado un lote de movimientos
// bancarios sin conciliar y las líneas candidatas del libro mayor,
// arma la lista de emparejamientos automáticos.
//
// Reglas:
// - El monto debe coincidir (dentro de amountTolerance).
// - La fecha debe estar dentro de toleranceDays.
// - Si un movimiento tiene más de un candidato igual de cercano en
//   fecha, no se adivina: queda sin conciliar (ambigüedad real, va a la
//   cola de excepciones para resolución manual).
// - Cada línea del mayor se usa como máximo en un emparejamiento.
function findAutomaticMatches(bankTransactions, candidateLines, { toleranceDays = 3, amountTolerance = 0 } = {}) {
  const usedLineIds = new Set();
  const matches = [];
  const tolerance = new Decimal(amountTolerance);

  for (const tx of bankTransactions) {
    const txAmount = new Decimal(tx.amount);

    const candidates = candidateLines.filter((line) => {
      if (usedLineIds.has(line.id)) return false;
      const lineAmount = new Decimal(line.debit).minus(line.credit);
      const amountDiff = lineAmount.minus(txAmount).abs();
      if (amountDiff.greaterThan(tolerance)) return false;
      return Math.abs(daysBetween(tx.date, line.date)) <= toleranceDays;
    });

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => Math.abs(daysBetween(tx.date, a.date)) - Math.abs(daysBetween(tx.date, b.date)));
    const closestDiff = Math.abs(daysBetween(tx.date, candidates[0].date));
    const tied = candidates.filter((c) => Math.abs(daysBetween(tx.date, c.date)) === closestDiff);

    if (tied.length > 1) continue;

    const match = candidates[0];
    usedLineIds.add(match.id);
    matches.push({ bankTransactionId: tx.id, journalEntryLineId: match.id, dayDiff: closestDiff });
  }

  return matches;
}

module.exports = { findAutomaticMatches, daysBetween };
