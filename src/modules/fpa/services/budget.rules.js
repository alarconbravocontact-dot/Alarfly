const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');
const { evaluateFormula } = require('./formula-engine');

const { Decimal } = Prisma;

// Función pura: calcula el número de versión que le toca a un
// presupuesto nuevo dentro de un año fiscal. Solo puede haber una
// versión ORIGINAL por año (la primera); cualquier ajuste posterior
// es un REFORECAST y necesita que ya exista al menos una versión.
function determineNextVersion(existingVersionNumbers, versionType) {
  if (versionType === 'ORIGINAL' && existingVersionNumbers.length > 0) {
    throw new AppError(
      'Ya existe una versión ORIGINAL para este año fiscal; usa REFORECAST para ajustarla.',
      409,
      'ORIGINAL_ALREADY_EXISTS'
    );
  }
  if (versionType === 'REFORECAST' && existingVersionNumbers.length === 0) {
    throw new AppError('No se puede crear un REFORECAST sin una versión ORIGINAL previa.', 409, 'NO_ORIGINAL_VERSION');
  }

  const max = existingVersionNumbers.length ? Math.max(...existingVersionNumbers) : 0;
  return max + 1;
}

// Función pura: solo se permiten estos pasos de estado (DRAFT ->
// IN_REVIEW -> APPROVED, con posibilidad de devolver a DRAFT desde
// revisión si hay que corregir algo).
const ALLOWED_TRANSITIONS = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: [],
};

function assertCanTransition(currentStatus, targetStatus) {
  if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(targetStatus)) {
    throw new AppError(
      `No se puede pasar un presupuesto de "${currentStatus}" a "${targetStatus}".`,
      409,
      'INVALID_BUDGET_TRANSITION'
    );
  }
}

// Función pura: resuelve el monto final de cada línea de un
// presupuesto. Las líneas FIXED se toman tal cual; las FORMULA se
// evalúan con el motor de fórmulas, usando como variables SOLO las
// líneas FIXED del mismo presupuesto (referenciadas como
// [código-de-cuenta_mes]) — así una fórmula puede repartir por driver
// (ej: "[4135_1] * 0.05"), pero no depende de otra fórmula, para no
// tener que resolver dependencias entre fórmulas.
// `lines` necesita { id, accountCode, period, amountType, amount, formula }.
function resolveBudgetLineAmounts(lines) {
  const variables = {};
  for (const line of lines) {
    if (line.amountType === 'FIXED') {
      variables[`${line.accountCode}_${line.period}`] = new Decimal(line.amount || 0);
    }
  }

  const resolved = new Map();
  for (const line of lines) {
    if (line.amountType === 'FIXED') {
      resolved.set(line.id, new Decimal(line.amount || 0));
    } else {
      resolved.set(line.id, evaluateFormula(line.formula, variables));
    }
  }
  return resolved;
}

// Función pura: desviación de una línea (real vs. presupuestado).
function calculateVariance(budgetedAmount, actualAmount) {
  const budgeted = new Decimal(budgetedAmount);
  const actual = new Decimal(actualAmount);
  const varianceAmount = actual.minus(budgeted);
  const variancePercentage = budgeted.isZero()
    ? (actual.isZero() ? new Decimal(0) : new Decimal(100))
    : varianceAmount.dividedBy(budgeted.abs()).times(100);
  return { varianceAmount, variancePercentage };
}

// Función pura: si el valor absoluto de la desviación supera el umbral
// configurado, se exige justificación.
function exceedsThreshold(variancePercentage, thresholdPercentage) {
  return new Decimal(variancePercentage).abs().greaterThan(new Decimal(thresholdPercentage));
}

module.exports = {
  determineNextVersion,
  assertCanTransition,
  resolveBudgetLineAmounts,
  calculateVariance,
  exceedsThreshold,
};
