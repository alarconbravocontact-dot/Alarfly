const { Prisma } = require('@prisma/client');
const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');
const ledgerService = require('../ledger/ledger.service');
const { calculateFxDifferential, assertBaseCurrencySettlement } = require('./fx.rules');

const { Decimal } = Prisma;

function accountBalance(account, debit, credit) {
  const d = new Decimal(debit || 0);
  const c = new Decimal(credit || 0);
  return account.normalBalance === 'DEBIT' ? d.minus(c) : c.minus(d);
}

// Fase 6 (sección 41): toda modificación sensible de una tasa debe
// quedar auditada (quién/cuándo/qué tasa/valor anterior/valor nuevo) —
// reutiliza core/audit, el mismo mecanismo que ya usa el resto del
// proyecto, nunca un sistema de auditoría propio. `upsert` sigue siendo
// idempotente por `[companyId, currency, date]`: volver a registrar la
// misma fecha CORRIGE esa fila (con su rastro en el audit log), nunca
// crea una fecha nueva ni reinterpreta una operación histórica ya
// posterior a esa fecha (eso lo protege el snapshot de cada pago/asiento,
// ver `resolveForeignAmountSnapshot`, no esta función).
async function recordRate({ companyId, userId, currency, rate, date, source }) {
  const existing = await prisma.exchangeRate.findUnique({
    where: { companyId_currency_date: { companyId, currency, date } },
  });
  const saved = await prisma.exchangeRate.upsert({
    where: { companyId_currency_date: { companyId, currency, date } },
    update: { rate, source: source || existing?.source || 'BCV' },
    create: { companyId, currency, rate, date, source: source || 'BCV' },
  });
  await auditService.log({
    companyId,
    userId,
    action: existing ? 'exchange_rate.updated' : 'exchange_rate.recorded',
    entityType: 'ExchangeRate',
    entityId: saved.id,
    oldValue: existing ? { rate: existing.rate, source: existing.source } : null,
    newValue: { currency, rate: saved.rate, date, source: saved.source },
  });
  return saved;
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

// Fase 6 (sección 9/13/23/24): antes vivía duplicada, byte por byte, en
// `ar-payments.service.js` y `ap-payments.service.js` — con esta pieza
// AP gana el mismo mecanismo de cobro/pago en moneda extranjera que ya
// tenía AR (bankTransactionId), así que ahora son 2 consumidores reales
// con el mismo código exacto: se extrajo acá, la única lógica de
// "resolver cuánto vale, en moneda base, un monto dado en moneda
// extranjera, con la tasa vigente a esa fecha, y guardar el snapshot
// para no recalcularlo nunca más" — no un ConversionService nuevo, es
// la misma llamada a `getLatestRate` que ya existía, solo que ahora en
// un solo lugar. Devuelve `null` si no se pidió conversión (caso normal,
// pago ya en moneda base).
async function resolveForeignAmountSnapshot(companyId, { foreignCurrency, foreignAmount, date }) {
  if (!foreignCurrency || foreignAmount == null) return null;
  const rate = await getLatestRate(companyId, foreignCurrency, date);
  const amount = new Decimal(foreignAmount);
  return { foreignCurrency, foreignAmount: amount, exchangeRate: new Decimal(rate.rate), amount: amount.times(rate.rate) };
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

module.exports = {
  recordRate,
  listRates,
  getAllLatestRates,
  getLatestRate,
  resolveForeignAmountSnapshot,
  assertBaseCurrencySettlement,
  revalueAccount,
  revalueCompany,
};
