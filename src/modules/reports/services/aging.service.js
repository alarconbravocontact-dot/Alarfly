// Antigüedad de Saldos (punto 3, ya no bloqueado ahora que existe
// AR/AP): solo lectura sobre ArInvoice/ApBill, que ya tienen fecha de
// vencimiento y saldo pendiente — no se creó ninguna tabla nueva.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const { buildAgingReport } = require('./aging.rules');

const { Decimal } = Prisma;

async function getReceivablesAging(companyId, asOfDate = new Date()) {
  const invoices = await prisma.arInvoice.findMany({
    where: { companyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
    include: { customer: true },
  });

  const items = invoices.map((invoice) => ({
    id: invoice.id,
    name: invoice.customer.name,
    customerId: invoice.customerId,
    documentNumber: invoice.invoiceNumber,
    dueDate: invoice.dueDate,
    balance: new Decimal(invoice.totalAmount).minus(invoice.paidAmount),
  }));

  return buildAgingReport(items, asOfDate);
}

async function getPayablesAging(companyId, asOfDate = new Date()) {
  const bills = await prisma.apBill.findMany({
    where: { companyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
    include: { vendor: true },
  });

  const items = bills.map((bill) => ({
    id: bill.id,
    name: bill.vendor.name,
    vendorId: bill.vendorId,
    documentNumber: bill.billNumber,
    dueDate: bill.dueDate,
    balance: new Decimal(bill.totalAmount).minus(bill.paidAmount),
  }));

  return buildAgingReport(items, asOfDate);
}

module.exports = { getReceivablesAging, getPayablesAging };
