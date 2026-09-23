const { Prisma } = require('@prisma/client');
const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const ledgerService = require('../ledger/ledger.service');
const { calculateFxDifferential } = require('./fx.rules');

const { Decimal } = Prisma;

function accountBalance(account, debit, credit) {
  const d = new Decimal(debit || 0);
  const c = new Decimal(credit || 0);
  return account.normalBalance === 'DEBIT' ? d.minus(c) : c.minus(d);
}

async function recordRate({ companyId, currency, rate, date }) {
  return prisma.exchangeRate.upsert({
    where: { companyId_currency_date: { companyId, currency, date } },
    update: { rate },
    create: { companyId, currency, rate, date },
  });
}

async function listRates(companyId, currency) {
  return prisma.exchangeRate.findMany({
    where: { companyId, currency: currency || undefined },
    orderBy: { date: 'desc' },
  });
}

// Selector de divisa de visualización: la tasa más reciente de CADA
// moneda registrada, en una sola consulta — nunca revalida ni escribe
// nada, es solo lectura para convertir montos en pantalla. Como son
// pocas monedas por empresa, se filtra en memoria en vez de una
// consulta SQL por moneda.
async function getAllLatestRates(companyId) {
  const rates = await prisma.exchangeRate.findMany({
    where: { companyId },
    orderBy: { date: 'desc' },
  });
  const latestByCurrency = new Map();
  for (const rate of rates) {
    if (!latestByCurrency.has(rate.currency)) latestByCurrency.set(rate.currency, rate);
  }
  return Array.from(latestByCurrency.values());
}

async function getLatestRate(companyId, currency, asOfDate) {
  const rate = await prisma.exchangeRate.findFirst({
    where: { companyId, currency, date: { lte: asOfDate } },
    orderBy: { date: 'desc' },
  });
  if (!rate) {
    throw new AppError(
      `No hay una tasa de cambio registrada para "${currency}" antes de esa fecha.`,
      404,
      'RATE_NOT_FOUND'
    );
  }
  return rate;
}

// Revalúa una sola cuenta en moneda extranjera: si el saldo que "debería"
// tener (según la tasa más reciente) no coincide con el saldo actual en
// libros, postea la diferencia como un asiento automático. Devuelve null
// si no hay nada que ajustar.
async function revalueAccount(companyId, account, asOfDate, userId) {
  const settings = await prisma.accountingSettings.findUnique({ where: { companyId } });
  if (!settings?.fxGainLossAccountId) {
    throw new AppError(
      'Debes configurar la cuenta de diferencial cambiario antes de revaluar (AccountingSettings.fxGainLossAccountId).',
      400,
      'FX_GAIN_LOSS_ACCOUNT_NOT_CONFIGURED'
    );
  }

  const rate = await getLatestRate(companyId, account.foreignCurrencyCode, asOfDate);

  const sums = await prisma.journalEntryLine.aggregate({
    where: { accountId: account.id, journalEntry: { companyId, status: 'APPROVED', date: { lte: asOfDate } } },
    _sum: { debit: true, credit: true, foreignDebit: true, foreignCredit: true },
  });

  const foreignBalance = accountBalance(account, sums._sum.foreignDebit, sums._sum.foreignCredit);
  if (foreignBalance.isZero()) return null;

  const currentBaseBalance = accountBalance(account, sums._sum.debit, sums._sum.credit);
  const { differential } = calculateFxDifferential(foreignBalance, currentBaseBalance, rate.rate);
  if (differential.isZero()) return null;

  const magnitude = differential.abs();
  const addToNormalSide = differential.isPositive();
  const accountTakesDebit = addToNormalSide === (account.normalBalance === 'DEBIT');

  const lines = accountTakesDebit
    ? [
        { accountId: account.id, debit: magnitude.toNumber(), credit: 0 },
        { accountId: settings.fxGainLossAccountId, debit: 0, credit: magnitude.toNumber() },
      ]
    : [
        { accountId: account.id, debit: 0, credit: magnitude.toNumber() },
        { accountId: settings.fxGainLossAccountId, debit: magnitude.toNumber(), credit: 0 },
      ];

  return ledgerService.postEntry({
    companyId,
    date: asOfDate,
    description: `Revaluación cambiaria de "${account.name}" (${account.foreignCurrencyCode} a ${rate.rate.toString()})`,
    lines,
    origin: 'AUTOMATIC',
    sourceModule: 'core-fx',
    sourceReference: account.id,
    createdByUserId: userId,
    autoApprove: true,
  });
}

async function revalueCompany(companyId, asOfDate, userId) {
  const accounts = await prisma.account.findMany({
    where: { companyId, isForeignCurrency: true, isActive: true },
  });

  const postedEntries = [];
  for (const account of accounts) {
    const entry = await revalueAccount(companyId, account, asOfDate, userId);
    if (entry) postedEntries.push(entry);
  }
  return postedEntries;
}

module.exports = { recordRate, listRates, getAllLatestRates, getLatestRate, revalueAccount, revalueCompany };
