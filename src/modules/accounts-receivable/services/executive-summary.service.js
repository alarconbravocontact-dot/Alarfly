// Resumen ejecutivo de Cuentas por Cobrar (tarjetas colapsables del
// Módulo AR/AP): 4 números clave con un sparkline de 30 días cada
// uno — de solo lectura, nunca escribe nada, agrega sobre datos que AR
// ya guarda (mismo criterio que Reportes).
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const { buildDailyFlowTrend, buildReceivableBalanceTrend } = require('./executive-summary.rules');

const { Decimal } = Prisma;
const TREND_DAYS = 30;

function monthRange(referenceDate) {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function sumAmount(items, field) {
  return items.reduce((sum, item) => sum.plus(item[field]), new Decimal(0)).toFixed(2);
}

async function getExecutiveSummary(companyId) {
  const referenceDate = new Date();
  const trendStart = new Date(referenceDate.getTime() - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000);
  const trendStart0 = new Date(Date.UTC(trendStart.getUTCFullYear(), trendStart.getUTCMonth(), trendStart.getUTCDate()));

  const [invoices, applications, invoicesInTrendWindow, paymentsInTrendWindow] = await Promise.all([
    // Toda la historia abierta: se necesita para reconstruir el saldo
    // de días pasados aunque la factura se haya emitido hace tiempo.
    prisma.arInvoice.findMany({
      where: { companyId, status: { not: 'CANCELLED' } },
      select: { id: true, issueDate: true, dueDate: true, totalAmount: true },
    }),
    prisma.arPaymentApplication.findMany({
      where: { invoice: { companyId } },
      select: { invoiceId: true, amount: true, payment: { select: { date: true } } },
    }),
    prisma.arInvoice.findMany({
      where: { companyId, status: { not: 'CANCELLED' }, issueDate: { gte: trendStart0 } },
      select: { issueDate: true, totalAmount: true },
    }),
    prisma.arPayment.findMany({
      where: { companyId, date: { gte: trendStart0 } },
      select: { date: true, amount: true },
    }),
  ]);

  const applicationsWithDate = applications.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount, paymentDate: a.payment.date }));
  const balanceTrend = buildReceivableBalanceTrend(invoices, applicationsWithDate, TREND_DAYS, referenceDate);
  const invoicedTrend = buildDailyFlowTrend(invoicesInTrendWindow, 'issueDate', 'totalAmount', TREND_DAYS, referenceDate);
  const collectedTrend = buildDailyFlowTrend(paymentsInTrendWindow, 'date', 'amount', TREND_DAYS, referenceDate);

  const today = balanceTrend[balanceTrend.length - 1];

  const { start: monthStart, end: monthEnd } = monthRange(referenceDate);
  const invoicesThisMonth = invoicesInTrendWindow.filter((inv) => inv.issueDate >= monthStart && inv.issueDate <= monthEnd);
  const paymentsThisMonth = paymentsInTrendWindow.filter((p) => p.date >= monthStart && p.date <= monthEnd);

  return {
    totalReceivable: {
      label: 'Total por cobrar',
      value: today.receivable,
      sparkline: balanceTrend.map((d) => ({ date: d.date, value: d.receivable })),
    },
    overdue: {
      label: 'Vencido',
      value: today.overdue,
      sparkline: balanceTrend.map((d) => ({ date: d.date, value: d.overdue })),
    },
    invoicedThisMonth: {
      label: 'Facturado este mes',
      value: sumAmount(invoicesThisMonth, 'totalAmount'),
      sparkline: invoicedTrend,
    },
    collectedThisMonth: {
      label: 'Cobrado este mes',
      value: sumAmount(paymentsThisMonth, 'amount'),
      sparkline: collectedTrend,
    },
  };
}

module.exports = { getExecutiveSummary };
