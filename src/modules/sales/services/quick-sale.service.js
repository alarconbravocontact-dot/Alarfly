// Venta Rápida (punto 20-22): NO es un segundo motor — es una sola
// función que llama a los mismos dos servicios que ya existen
// (ar-invoices.service.createInvoice, ar-payments.service.recordPayment)
// uno después del otro. Cada uno ya es atómico por su cuenta (Fase 1);
// no se fuerzan ambos dentro de una única transacción gigante a
// propósito: son dos hechos de negocio reales y separables (vender y
// cobrar), exactamente como ya se tratan en el resto de la app cuando
// alguien crea una factura y después la cobra en dos pasos — Venta
// Rápida solo automatiza que ocurran uno inmediatamente después del
// otro. Si el cobro fallara después de crear la factura, la factura
// queda en pie (correcto: el producto sí se vendió) y el cobro se
// puede reintentar por separado, sin duplicar ni perder la venta.
const AppError = require('../../../core/utils/AppError');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const arInvoicesService = require('../../accounts-receivable/services/ar-invoices.service');
const arPaymentsService = require('../../accounts-receivable/services/ar-payments.service');

async function quickSale(companyId, userId, data) {
  let customerId = data.customerId || null;
  if (!customerId) {
    customerId = await arApSettingsService.resolveDefaultCustomerId(companyId);
    if (!customerId) {
      throw new AppError(
        'Esta venta necesita un cliente: no hay "Consumidor Final" configurado. Indica un cliente o configúralo en Ajustes de CxC.',
        400,
        'CUSTOMER_REQUIRED'
      );
    }
  }

  const invoice = await arInvoicesService.createInvoice(companyId, userId, {
    customerId,
    jurisdictionId: data.jurisdictionId,
    incomeAccountId: data.incomeAccountId,
    issueDate: data.issueDate,
    taxRateId: data.taxRateId,
    withholdingRateId: data.withholdingRateId,
    lines: data.lines,
  });

  if (!data.payment) {
    return { invoice, payment: null };
  }

  const payment = await arPaymentsService.recordPayment(companyId, userId, {
    customerId,
    date: data.issueDate,
    treasuryAccountId: data.payment.treasuryAccountId,
    bankTransactionId: data.payment.bankTransactionId,
    paymentMethodId: data.payment.paymentMethodId,
    amount: data.payment.amount,
    foreignCurrency: data.payment.foreignCurrency,
    foreignAmount: data.payment.foreignAmount,
    applyFullyToInvoiceId: invoice.id,
  });

  return { invoice, payment };
}

module.exports = { quickSale };
