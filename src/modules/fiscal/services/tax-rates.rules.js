const AppError = require('../../../core/utils/AppError');

function rangeEnd(range) {
  return range.validTo || new Date('9999-12-31T23:59:59.999Z');
}

function rangesOverlap(a, b) {
  return a.validFrom <= rangeEnd(b) && b.validFrom <= rangeEnd(a);
}

// Función pura: evita crear dos tasas activas del mismo tipo/aplicación
// en la misma jurisdicción con vigencias que se cruzan — así nunca es
// ambiguo qué tasa le tocaba a una transacción en una fecha dada.
function assertNoRateOverlap(existingRates, newRate) {
  for (const existing of existingRates) {
    if (rangesOverlap(existing, newRate)) {
      throw new AppError(
        `Ya existe la tasa "${existing.code}" vigente en un rango de fechas que se cruza con esta.`,
        409,
        'TAX_RATE_OVERLAP'
      );
    }
  }
}

// Función pura: de una lista de tasas ya filtradas (misma jurisdicción,
// tipo y aplicación), encuentra la que estaba vigente en `date`. Si por
// algún motivo hubiera más de una (no debería pasar si se usó
// assertNoRateOverlap al crearlas), se queda con la de vigencia más
// reciente en vez de fallar.
function findApplicableRate(rates, date) {
  const matches = rates.filter((rate) => rate.validFrom <= date && (!rate.validTo || date <= rate.validTo));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.validFrom - a.validFrom)[0];
}

module.exports = { assertNoRateOverlap, findApplicableRate };
