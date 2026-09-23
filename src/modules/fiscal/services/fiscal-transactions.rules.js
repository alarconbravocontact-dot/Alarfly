const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: arma las líneas del asiento contable de una
// transacción fiscal (venta o compra), siempre balanceadas por
// construcción — no hace falta volver a validar partida doble aquí,
// eso ya lo hace core/ledger cuando se postean estas líneas.
//
// VENTA:   DB Contraparte (neto) [+ DB Retención]  =  CR Ingreso + CR Impuesto
// COMPRA:  DB Gasto + DB Impuesto  =  CR Contraparte (neto) [+ CR Retención]
function buildFiscalTransactionLines({
  type,
  taxBase,
  taxAmount,
  withholdingAmount,
  taxBaseAccountId,
  counterpartyAccountId,
  taxAccountId,
  withholdingAccountId,
}) {
  const base = new Decimal(taxBase);
  const tax = new Decimal(taxAmount || 0);
  const withholding = new Decimal(withholdingAmount || 0);

  if (tax.greaterThan(0) && !taxAccountId) {
    throw new AppError('Falta indicar la cuenta contable del impuesto (taxAccountId).', 400, 'TAX_ACCOUNT_REQUIRED');
  }
  if (withholding.greaterThan(0) && !withholdingAccountId) {
    throw new AppError(
      'Falta indicar la cuenta contable de la retención (withholdingAccountId).',
      400,
      'WITHHOLDING_ACCOUNT_REQUIRED'
    );
  }

  const netCounterparty = base.plus(tax).minus(withholding);
  const zero = new Decimal(0);
  const lines = [];

  if (type === 'SALE') {
    lines.push({ accountId: counterpartyAccountId, debit: netCounterparty, credit: zero });
    if (withholding.greaterThan(0)) {
      lines.push({ accountId: withholdingAccountId, debit: withholding, credit: zero });
    }
    lines.push({ accountId: taxBaseAccountId, debit: zero, credit: base });
    if (tax.greaterThan(0)) {
      lines.push({ accountId: taxAccountId, debit: zero, credit: tax });
    }
  } else {
    lines.push({ accountId: taxBaseAccountId, debit: base, credit: zero });
    if (tax.greaterThan(0)) {
      lines.push({ accountId: taxAccountId, debit: tax, credit: zero });
    }
    lines.push({ accountId: counterpartyAccountId, debit: zero, credit: netCounterparty });
    if (withholding.greaterThan(0)) {
      lines.push({ accountId: withholdingAccountId, debit: zero, credit: withholding });
    }
  }

  return lines;
}

module.exports = { buildFiscalTransactionLines };
