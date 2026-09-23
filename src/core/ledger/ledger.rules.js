const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');

const { Decimal } = Prisma;

// Función pura (sin base de datos): valida partida doble. Se puede
// probar con tests unitarios sin necesitar una conexión real.
function validateBalancedLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new AppError(
      'Un asiento necesita al menos dos líneas (una de débito y una de crédito).',
      400,
      'INSUFFICIENT_LINES'
    );
  }

  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  for (const line of lines) {
    const debit = new Decimal(line.debit || 0);
    const credit = new Decimal(line.credit || 0);

    if (debit.isNegative() || credit.isNegative()) {
      throw new AppError('Los montos de débito y crédito no pueden ser negativos.', 400, 'NEGATIVE_AMOUNT');
    }
    if (debit.isZero() && credit.isZero()) {
      throw new AppError('Cada línea del asiento debe tener un monto en débito o en crédito.', 400, 'EMPTY_LINE');
    }
    if (!debit.isZero() && !credit.isZero()) {
      throw new AppError('Una línea no puede tener monto en débito y en crédito a la vez.', 400, 'BOTH_SIDES_FILLED');
    }

    totalDebit = totalDebit.plus(debit);
    totalCredit = totalCredit.plus(credit);
  }

  if (totalDebit.isZero()) {
    throw new AppError('El asiento no puede tener un monto total de cero.', 400, 'ZERO_ENTRY');
  }

  if (!totalDebit.equals(totalCredit)) {
    throw new AppError(
      `El asiento no está balanceado: débito ${totalDebit.toFixed(2)} vs. crédito ${totalCredit.toFixed(2)}.`,
      400,
      'UNBALANCED_ENTRY'
    );
  }

  return { totalDebit, totalCredit };
}

module.exports = { validateBalancedLines };
