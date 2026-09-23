// Glosario central: la lista de términos es texto estático (ver
// glossary-catalog.js); el valor en vivo de cada término reutiliza
// servicios ya existentes y probados de otros módulos — nunca
// recalcula nada, solo pregunta lo mismo que ya pregunta el Panel
// principal o FP&A.
const { Prisma } = require('@prisma/client');
const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const { TERMS, TERMS_BY_KEY } = require('./glossary-catalog');
const kpisService = require('../../modules/fpa/services/kpis.service');
const treasuryAccountsService = require('../../modules/treasury/services/treasury-accounts.service');
const arExecutiveSummaryService = require('../../modules/accounts-receivable/services/executive-summary.service');

const { Decimal } = Prisma;

function listTerms() {
  return TERMS.map(({ key, label, definition, hasLiveValue }) => ({ key, label, definition, hasLiveValue }));
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

async function getAccountsPayableTotal(companyId) {
  const bills = await prisma.apBill.findMany({
    where: { companyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
    select: { totalAmount: true, paidAmount: true },
  });
  const total = bills.reduce((sum, b) => sum.plus(new Decimal(b.totalAmount).minus(b.paidAmount)), new Decimal(0));
  return total.toFixed(2);
}

async function getLiveValue(companyId, key) {
  const term = TERMS_BY_KEY.get(key);
  if (!term) throw new AppError('Ese término no existe en el glosario.', 404, 'GLOSSARY_TERM_NOT_FOUND');
  if (!term.hasLiveValue) throw new AppError('Este término no tiene un valor en vivo para mostrar.', 400, 'GLOSSARY_TERM_HAS_NO_LIVE_VALUE');

  const { from, to } = currentMonthRange();

  switch (key) {
    case 'ebitda': {
      const r = await kpisService.getEbitda(companyId, { from, to });
      return { value: r.ebitda, label: 'EBITDA de este mes' };
    }
    case 'burn-rate': {
      const r = await kpisService.getBurnRateAndRunway(companyId, { from, to });
      return { value: r.monthlyBurnRate, label: 'Tu burn rate de este mes' };
    }
    case 'runway': {
      const r = await kpisService.getBurnRateAndRunway(companyId, { from, to });
      return { value: r.runwayMonths, unit: 'meses', label: 'Tu runway actual' };
    }
    case 'liquidity-cushion': {
      const r = await treasuryAccountsService.getConsolidatedCashPosition(companyId);
      return { value: r.liquidityCushion, currency: r.baseCurrency, label: 'Tu colchón de liquidez actual' };
    }
    case 'accounts-receivable': {
      const r = await arExecutiveSummaryService.getExecutiveSummary(companyId);
      return { value: r.totalReceivable.value, label: 'Tu total por cobrar ahora mismo' };
    }
    case 'accounts-payable': {
      const value = await getAccountsPayableTotal(companyId);
      return { value, label: 'Tu total por pagar ahora mismo' };
    }
    default:
      throw new AppError('Este término no tiene un valor en vivo para mostrar.', 400, 'GLOSSARY_TERM_HAS_NO_LIVE_VALUE');
  }
}

module.exports = { listTerms, getLiveValue };
