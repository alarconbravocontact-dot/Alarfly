// Previsión de Liquidez (punto 5): proyección semana a semana del
// saldo de caja, combinando datos que YA existen — nunca inventa una
// tabla de facturas propia. Reutiliza:
//   - la posición de caja consolidada actual (punto 1, ya construido)
//   - ArInvoice.dueDate/ApBill.dueDate (Fase 3, AR/AP)
//   - DebtInstallment.dueDate (punto 7, ya construido)
//   - PaymentOrder.scheduledDate para órdenes todavía no pagadas
//     (status APPROVED en este sistema significa "ya se pagó" — ver
//     payment-orders.service, así que se excluyen del pronóstico)
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const treasuryAccountsService = require('./treasury-accounts.service');
const { buildWeeklyBuckets, buildLiquidityForecast, findFirstNegativeWeek } = require('./liquidity-forecast.rules');

const { Decimal } = Prisma;

async function getLiquidityForecast(companyId, { weeks = 8 } = {}) {
  const cashPosition = await treasuryAccountsService.getConsolidatedCashPosition(companyId);
  const today = new Date();
  const buckets = buildWeeklyBuckets(today, weeks);
  const horizonEnd = buckets[buckets.length - 1].weekEnd;

  const [arInvoices, apBills, debtInstallments, paymentOrders] = await Promise.all([
    prisma.arInvoice.findMany({
      where: { companyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lte: horizonEnd } },
      select: { dueDate: true, totalAmount: true, paidAmount: true },
    }),
    prisma.apBill.findMany({
      where: { companyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lte: horizonEnd } },
      select: { dueDate: true, totalAmount: true, paidAmount: true },
    }),
    prisma.debtInstallment.findMany({
      where: { status: 'PENDING', dueDate: { lte: horizonEnd }, debt: { companyId } },
      select: { dueDate: true, principalPortion: true, interestPortion: true },
    }),
    prisma.paymentOrder.findMany({
      where: { companyId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] }, scheduledDate: { lte: horizonEnd } },
      select: { scheduledDate: true, amount: true },
    }),
  ]);

  const movements = [
    ...arInvoices.map((invoice) => ({
      date: invoice.dueDate,
      amount: new Decimal(invoice.totalAmount).minus(invoice.paidAmount),
    })),
    ...apBills.map((bill) => ({
      date: bill.dueDate,
      amount: new Decimal(bill.totalAmount).minus(bill.paidAmount).negated(),
    })),
    ...debtInstallments.map((installment) => ({
      date: installment.dueDate,
      amount: new Decimal(installment.principalPortion).plus(installment.interestPortion).negated(),
    })),
    ...paymentOrders.map((order) => ({ date: order.scheduledDate, amount: new Decimal(order.amount).negated() })),
  ];

  const forecastWeeks = buildLiquidityForecast(cashPosition.totalInBaseCurrency, buckets, movements);

  return {
    startingBalance: new Decimal(cashPosition.totalInBaseCurrency).toFixed(2),
    generatedAt: today,
    weeks: forecastWeeks,
    firstNegativeWeek: findFirstNegativeWeek(forecastWeeks),
    note:
      'Incluye facturas de clientes/proveedores con fecha de vencimiento, cuotas de deuda pendientes y órdenes de pago todavía sin aprobar. No incluye caja chica ni gastos operativos que no pasen por una factura registrada en AR/AP.',
  };
}

module.exports = { getLiquidityForecast };
