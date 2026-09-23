// Calendario de Pagos (ampliación del punto 6/8 ya construido): ubica
// CADA documento real con fecha de vencimiento que representa una
// salida de dinero — facturas de compra abiertas, cuotas de deuda
// pendientes, órdenes de pago todavía sin aprobar — para detectar de
// un vistazo semanas/días con concentración alta de pagos, y reutiliza
// la Previsión de Liquidez ya existente (punto 5) para el aviso de
// saldo insuficiente por semana. No incluye facturas de venta (AR):
// son entradas de dinero, no pagos — el pedido explícitamente habla
// de "concentración de PAGOS".
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const { buildWeeklyBuckets } = require('./liquidity-forecast.rules');
const { getLiquidityForecast } = require('./liquidity-forecast.service');
const { groupDocumentsByDay, detectHighConcentrationDays } = require('./payment-calendar.rules');

const { Decimal } = Prisma;

async function getPaymentCalendar(companyId, { weeks = 4 } = {}) {
  const today = new Date();
  const buckets = buildWeeklyBuckets(today, weeks);
  const horizonEnd = buckets[buckets.length - 1].weekEnd;

  const [apBills, debtInstallments, paymentOrders, forecast] = await Promise.all([
    prisma.apBill.findMany({
      where: { companyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lte: horizonEnd } },
      select: { id: true, billNumber: true, dueDate: true, totalAmount: true, paidAmount: true, vendor: { select: { name: true } } },
    }),
    prisma.debtInstallment.findMany({
      where: { status: 'PENDING', dueDate: { lte: horizonEnd }, debt: { companyId } },
      select: { id: true, installmentNumber: true, dueDate: true, principalPortion: true, interestPortion: true, debt: { select: { name: true } } },
    }),
    prisma.paymentOrder.findMany({
      where: { companyId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] }, scheduledDate: { lte: horizonEnd } },
      select: { id: true, payeeName: true, scheduledDate: true, amount: true, currency: true },
    }),
    getLiquidityForecast(companyId, { weeks }),
  ]);

  const documents = [
    ...apBills.map((b) => ({
      id: b.id,
      type: 'AP_BILL',
      date: b.dueDate,
      amount: new Decimal(b.totalAmount).minus(b.paidAmount).toFixed(2),
      label: `Factura de compra N.º ${b.billNumber} · ${b.vendor.name}`,
      link: '/cuentas/facturas-compra',
    })),
    ...debtInstallments.map((i) => ({
      id: i.id,
      type: 'DEBT_INSTALLMENT',
      date: i.dueDate,
      amount: new Decimal(i.principalPortion).plus(i.interestPortion).toFixed(2),
      label: `Cuota ${i.installmentNumber} de ${i.debt.name}`,
      link: '/tesoreria/deuda',
    })),
    ...paymentOrders.map((o) => ({
      id: o.id,
      type: 'PAYMENT_ORDER',
      date: o.scheduledDate,
      amount: new Decimal(o.amount).toFixed(2),
      label: `Orden de pago a ${o.payeeName}`,
      link: '/tesoreria/pagos',
    })),
  ];

  const dayGroups = groupDocumentsByDay(documents);
  const highConcentrationDates = detectHighConcentrationDays(dayGroups);

  return {
    weeks: forecast.weeks,
    documents,
    dayGroups,
    highConcentrationDates,
    note:
      'Incluye facturas de compra abiertas, cuotas de deuda pendientes y órdenes de pago todavía sin aprobar — no incluye facturas de venta (son entradas de dinero, no pagos) ni caja chica.',
  };
}

module.exports = { getPaymentCalendar };
