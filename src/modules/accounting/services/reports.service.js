const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Solo se reporta sobre asientos APROBADOS: borradores y pendientes
// todavía no son "verdad contable".
async function sumLinesByAccount(companyId, { from, to } = {}) {
  return prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      journalEntry: {
        companyId,
        status: 'APPROVED',
        date: from || to ? { gte: from, lte: to } : undefined,
      },
    },
    _sum: { debit: true, credit: true },
  });
}

function accountBalance(account, debit, credit) {
  return account.normalBalance === 'DEBIT' ? debit.minus(credit) : credit.minus(debit);
}

async function getGeneralLedger(companyId, accountId, { from, to } = {}) {
  const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
  if (!account) {
    throw new AppError('La cuenta indicada no existe.', 404, 'ACCOUNT_NOT_FOUND');
  }

  let openingBalance = new Decimal(0);
  if (from) {
    const openingSums = await prisma.journalEntryLine.aggregate({
      where: { accountId, journalEntry: { companyId, status: 'APPROVED', date: { lt: from } } },
      _sum: { debit: true, credit: true },
    });
    openingBalance = accountBalance(
      account,
      new Decimal(openingSums._sum.debit || 0),
      new Decimal(openingSums._sum.credit || 0)
    );
  }

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: { companyId, status: 'APPROVED', date: from || to ? { gte: from, lte: to } : undefined },
    },
    include: { journalEntry: { select: { id: true, entryNumber: true, date: true, description: true } } },
    orderBy: [{ journalEntry: { date: 'asc' } }, { order: 'asc' }],
  });

  let runningBalance = openingBalance;
  const movements = lines.map((line) => {
    const debit = new Decimal(line.debit);
    const credit = new Decimal(line.credit);
    runningBalance = runningBalance.plus(accountBalance(account, debit, credit));
    return {
      entryId: line.journalEntry.id,
      entryNumber: line.journalEntry.entryNumber,
      date: line.journalEntry.date,
      description: line.description || line.journalEntry.description,
      debit: debit.toFixed(2),
      credit: credit.toFixed(2),
      balance: runningBalance.toFixed(2),
    };
  });

  return {
    account: { id: account.id, code: account.code, name: account.name },
    openingBalance: openingBalance.toFixed(2),
    closingBalance: runningBalance.toFixed(2),
    movements,
  };
}

// Drill-down de los gráficos del Panel principal (ingresos/egresos por
// mes): mismo criterio que getGeneralLedger (que arma el libro mayor de
// UNA cuenta), pero generalizado a TODAS las cuentas de un tipo — es lo
// que compone la barra "Ingresos" o "Egresos" del gráfico, así que el
// usuario aterriza directo en los movimientos reales, no en un resumen.
async function getTransactionsByType(companyId, type, { from, to } = {}) {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      account: { companyId, type },
      journalEntry: { companyId, status: 'APPROVED', date: from || to ? { gte: from, lte: to } : undefined },
    },
    include: {
      account: { select: { id: true, code: true, name: true } },
      journalEntry: { select: { id: true, entryNumber: true, date: true, description: true } },
    },
    orderBy: [{ journalEntry: { date: 'asc' } }, { order: 'asc' }],
  });

  return lines.map((line) => ({
    entryId: line.journalEntry.id,
    entryNumber: line.journalEntry.entryNumber,
    date: line.journalEntry.date,
    description: line.description || line.journalEntry.description,
    accountId: line.account.id,
    accountCode: line.account.code,
    accountName: line.account.name,
    debit: new Decimal(line.debit).toFixed(2),
    credit: new Decimal(line.credit).toFixed(2),
  }));
}

async function getTrialBalance(companyId, asOfDate) {
  const accounts = await prisma.account.findMany({ where: { companyId }, orderBy: { code: 'asc' } });
  const sums = await sumLinesByAccount(companyId, { to: asOfDate });
  const sumsByAccount = new Map(sums.map((s) => [s.accountId, s._sum]));

  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  const rows = accounts
    .map((account) => {
      const sum = sumsByAccount.get(account.id) || { debit: 0, credit: 0 };
      const debit = new Decimal(sum.debit || 0);
      const credit = new Decimal(sum.credit || 0);
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        balance: accountBalance(account, debit, credit).toFixed(2),
      };
    })
    .filter((row) => Number(row.debit) !== 0 || Number(row.credit) !== 0);

  return { asOfDate, rows, totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2) };
}

async function getIncomeStatement(companyId, { from, to }) {
  const accounts = await prisma.account.findMany({ where: { companyId, type: { in: ['INCOME', 'EXPENSE'] } } });
  const sums = await sumLinesByAccount(companyId, { from, to });
  const sumsByAccount = new Map(sums.map((s) => [s.accountId, s._sum]));

  let totalIncome = new Decimal(0);
  let totalExpense = new Decimal(0);
  const sections = {};

  for (const account of accounts) {
    const sum = sumsByAccount.get(account.id) || { debit: 0, credit: 0 };
    const debit = new Decimal(sum.debit || 0);
    const credit = new Decimal(sum.credit || 0);
    const amount = account.type === 'INCOME' ? credit.minus(debit) : debit.minus(credit);
    if (amount.isZero()) continue;

    if (account.type === 'INCOME') totalIncome = totalIncome.plus(amount);
    else totalExpense = totalExpense.plus(amount);

    const key = account.financialStatementSection || 'SIN_CLASIFICAR';
    sections[key] = sections[key] || [];
    sections[key].push({ code: account.code, name: account.name, amount: amount.toFixed(2) });
  }

  return {
    from,
    to,
    sections,
    totalIncome: totalIncome.toFixed(2),
    totalExpense: totalExpense.toFixed(2),
    netIncome: totalIncome.minus(totalExpense).toFixed(2),
  };
}

// El Balance General no incluye tablas de "cierre" todavía (eso es
// trabajo futuro de fin de ejercicio): para que cuadre (Activo = Pasivo
// + Patrimonio) se muestra el resultado acumulado del periodo como una
// línea aparte dentro de Patrimonio, sin crear un asiento de cierre real.
async function getBalanceSheet(companyId, asOfDate) {
  const accounts = await prisma.account.findMany({ where: { companyId } });
  const sums = await sumLinesByAccount(companyId, { to: asOfDate });
  const sumsByAccount = new Map(sums.map((s) => [s.accountId, s._sum]));

  const sections = {};
  let totalAssets = new Decimal(0);
  let totalLiabilities = new Decimal(0);
  let totalEquity = new Decimal(0);
  let netIncomeToDate = new Decimal(0);

  for (const account of accounts) {
    const sum = sumsByAccount.get(account.id) || { debit: 0, credit: 0 };
    const debit = new Decimal(sum.debit || 0);
    const credit = new Decimal(sum.credit || 0);
    if (debit.isZero() && credit.isZero()) continue;

    if (account.type === 'INCOME') {
      netIncomeToDate = netIncomeToDate.plus(credit.minus(debit));
      continue;
    }
    if (account.type === 'EXPENSE') {
      netIncomeToDate = netIncomeToDate.minus(debit.minus(credit));
      continue;
    }

    const balance = accountBalance(account, debit, credit);
    // Los totales se acumulan con la convención débito/crédito propia del
    // TIPO de cuenta (Activo = débito neto, Pasivo/Patrimonio = crédito
    // neto), nunca con `balance` (que respeta el normalBalance de CADA
    // cuenta individual). Si no fuera así, una cuenta contra-activo (tipo
    // ASSET con normalBalance CREDIT, ej. Depreciación Acumulada) sumaría
    // en vez de restar y el Balance General quedaría descuadrado.
    if (account.type === 'ASSET') totalAssets = totalAssets.plus(debit.minus(credit));
    if (account.type === 'LIABILITY') totalLiabilities = totalLiabilities.plus(credit.minus(debit));
    if (account.type === 'EQUITY') totalEquity = totalEquity.plus(credit.minus(debit));

    const key = account.financialStatementSection || 'SIN_CLASIFICAR';
    sections[key] = sections[key] || [];
    sections[key].push({ code: account.code, name: account.name, balance: balance.toFixed(2) });
  }

  return {
    asOfDate,
    sections,
    totalAssets: totalAssets.toFixed(2),
    totalLiabilities: totalLiabilities.toFixed(2),
    totalEquity: totalEquity.toFixed(2),
    netIncomeToDate: netIncomeToDate.toFixed(2),
    totalLiabilitiesAndEquity: totalLiabilities.plus(totalEquity).plus(netIncomeToDate).toFixed(2),
  };
}

function buildVariance(amountA, amountB) {
  const a = new Decimal(amountA);
  const b = new Decimal(amountB);
  const variance = b.minus(a);
  const variancePercent = a.isZero() ? null : variance.div(a).times(100).toFixed(2);
  return { variance: variance.toFixed(2), variancePercent };
}

async function compareIncomeStatements(companyId, rangeA, rangeB) {
  const [a, b] = await Promise.all([getIncomeStatement(companyId, rangeA), getIncomeStatement(companyId, rangeB)]);
  return {
    periodA: { from: rangeA.from, to: rangeA.to, totalIncome: a.totalIncome, totalExpense: a.totalExpense, netIncome: a.netIncome },
    periodB: { from: rangeB.from, to: rangeB.to, totalIncome: b.totalIncome, totalExpense: b.totalExpense, netIncome: b.netIncome },
    netIncomeChange: buildVariance(a.netIncome, b.netIncome),
  };
}

async function compareBalanceSheets(companyId, asOfDateA, asOfDateB) {
  const [a, b] = await Promise.all([getBalanceSheet(companyId, asOfDateA), getBalanceSheet(companyId, asOfDateB)]);
  return {
    periodA: { asOfDate: asOfDateA, totalAssets: a.totalAssets, totalLiabilities: a.totalLiabilities },
    periodB: { asOfDate: asOfDateB, totalAssets: b.totalAssets, totalLiabilities: b.totalLiabilities },
    totalAssetsChange: buildVariance(a.totalAssets, b.totalAssets),
    totalLiabilitiesChange: buildVariance(a.totalLiabilities, b.totalLiabilities),
  };
}

module.exports = {
  getGeneralLedger,
  getTransactionsByType,
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  compareIncomeStatements,
  compareBalanceSheets,
};
