// Facturas de venta. Reutiliza el motor fiscal ya existente
// (fiscal/services/fiscal-transactions.service) para calcular
// impuesto/retención, correr las validaciones preventivas y postear el
// asiento vía core/ledger — este servicio NUNCA vuelve a calcular
// impuestos ni escribe JournalEntry directo, solo agrega encima lo que
// Fiscal no tenía: cliente real, fecha de vencimiento y seguimiento de
// cobro.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const fiscalTransactionsService = require('../../fiscal/services/fiscal-transactions.service');
const taxRatesService = require('../../fiscal/services/tax-rates.service');
const inventoryMovementsService = require('../../inventory/services/inventory-movements.service');
const { daysUntil } = require('../../../core/alerts/alerts.rules');
const { calculateDueDate, assertCustomerCreditOk, buildSalesTrend } = require('./ar-invoices.rules');
const { calculateLineAmount, remainingToInvoice, averageDeliveredUnitCost } = require('../../sales/services/sales-orders.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');

const { Decimal } = Prisma;

// Fase 3 (Ventas): resuelve, ANTES de tocar Fiscal/Ledger, qué hace
// falta cada línea con producto real (punto 10-11 y 17-19). Nunca
// duplica el cálculo de costo: si la línea viene de un Pedido ya
// entregado (`salesOrderLineId`), usa el costo real que YA dejó la
// entrega (`SalesOrderLine.deliveredCostTotal`, promedio de lo
// entregado); si es una venta directa/rápida de producto físico (sin
// pedido previo), la salida de inventario se genera recién dentro de
// la transacción de la factura — acá solo se valida que sea posible
// (variante real, almacén indicado) y se marca para resolverse después.
async function resolveLine(companyId, raw, index) {
  const quantity = new Decimal(raw.quantity ?? 1);
  const unitPrice = new Decimal(raw.unitPrice);
  const discount = new Decimal(raw.discount || 0);
  const amount = calculateLineAmount(quantity, unitPrice, discount);

  const base = { description: raw.description, quantity, unitPrice, discount, amount, order: index };

  if (!raw.variantId) {
    return { ...base, productVariantId: null, warehouseId: null, salesOrderLineId: null, unitCost: null, needsDirectExit: false };
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id: raw.variantId, product: { companyId } },
    include: { product: true },
  });
  if (!variant) {
    throw new AppError(`La línea ${index + 1} referencia una variante de producto que no existe.`, 404, 'PRODUCT_VARIANT_NOT_FOUND');
  }

  // Servicio: se factura igual, nunca toca inventario (punto 11).
  if (variant.product.isService) {
    return { ...base, productVariantId: variant.id, warehouseId: null, salesOrderLineId: null, unitCost: null, needsDirectExit: false };
  }

  if (raw.salesOrderLineId) {
    const orderLine = await prisma.salesOrderLine.findFirst({ where: { id: raw.salesOrderLineId, order: { companyId } } });
    if (!orderLine) {
      throw new AppError(`La línea ${index + 1} referencia una línea de pedido que no existe.`, 404, 'SALES_ORDER_LINE_NOT_FOUND');
    }
    const available = remainingToInvoice(orderLine);
    if (quantity.greaterThan(available)) {
      throw new AppError(
        `La línea "${orderLine.description}" del pedido solo tiene ${available.toFixed(4)} entregado y sin facturar.`,
        400,
        'INVOICE_EXCEEDS_DELIVERED_QUANTITY'
      );
    }
    const unitCost = averageDeliveredUnitCost(orderLine);
    return {
      ...base,
      productVariantId: variant.id,
      warehouseId: orderLine.warehouseId,
      salesOrderLineId: orderLine.id,
      unitCost,
      needsDirectExit: false,
    };
  }

  // Venta directa/Venta Rápida de producto físico, sin pedido previo
  // (punto 2/19/20): la línea SÍ va a generar una salida de inventario
  // real, dentro de esta misma factura — se resuelve más abajo, una
  // vez que la factura y sus líneas ya existan (createExit necesita
  // poder referenciarlas).
  if (!raw.warehouseId) {
    throw new AppError(`La línea ${index + 1} es de un producto físico y necesita indicar el almacén.`, 400, 'WAREHOUSE_REQUIRED_FOR_PHYSICAL_LINE');
  }
  return { ...base, productVariantId: variant.id, warehouseId: raw.warehouseId, salesOrderLineId: null, unitCost: null, needsDirectExit: true };
}

// Saldo pendiente actual del cliente y su factura abierta más
// atrasada — solo lectura, se usa para validar crédito antes de
// facturar (punto 2). No duplica `determineInvoiceStatus`: consulta
// directo lo que AR ya guarda por factura.
async function getCustomerCreditSnapshot(companyId, customerId) {
  const openInvoices = await prisma.arInvoice.findMany({
    where: { companyId, customerId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
    select: { totalAmount: true, paidAmount: true, dueDate: true },
  });

  const today = new Date();
  let currentOpenBalance = new Decimal(0);
  let maxDaysOverdueFound = 0;

  for (const invoice of openInvoices) {
    currentOpenBalance = currentOpenBalance.plus(new Decimal(invoice.totalAmount).minus(invoice.paidAmount));
    const overdueDays = -daysUntil(invoice.dueDate, today);
    if (overdueDays > maxDaysOverdueFound) maxDaysOverdueFound = overdueDays;
  }

  return { currentOpenBalance, maxDaysOverdueFound };
}

// `tx` (Fase 1 — Unit of Work): opcional. Lo usa ar-recurring.service
// (generación automática por plantilla) para que la factura y la marca
// de "ya generada" de la plantilla queden en una sola transacción — así
// un fallo a mitad de camino no puede duplicar la factura en el próximo
// cron. Si no se pasa, se comporta igual que siempre.
async function createInvoice(companyId, userId, data, tx = null) {
  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId, isActive: true } });
  if (!customer) {
    throw new AppError('El cliente indicado no existe o está inactivo.', 404, 'CUSTOMER_NOT_FOUND');
  }

  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new AppError('La factura necesita al menos una línea.', 400, 'INVOICE_LINES_REQUIRED');
  }

  const receivableGlAccountId = await arApSettingsService.assertReceivableAccountConfigured(companyId);

  const lines = [];
  for (let i = 0; i < data.lines.length; i++) {
    lines.push(await resolveLine(companyId, data.lines[i], i));
  }
  const subtotal = lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));

  // F17-E16: Rentabilidad por Producto (reports/profitability.service)
  // necesita la línea de INGRESO etiquetada con la misma FpaDimension
  // que ya etiqueta Inventario del lado del costo (ver
  // inventory-movements.service.tagCogsLineWithProduct) — sin esto, el
  // reporte siempre mostraba ingreso $0 para cualquier producto real,
  // aunque el costo sí apareciera, haciendo ver cualquier venta como
  // una pérdida del 100%. Como el motor fiscal postea un único renglón
  // de ingreso por factura (todas las líneas comparten la misma cuenta
  // — decisión ya documentada), solo se puede atribuir con certeza
  // cuando la factura entera es de UN solo producto: con más de un
  // producto distinto no hay forma de dividir ese único renglón sin
  // inventar un reparto, así que se deja sin etiquetar (mismo
  // resultado que hoy, no se empeora nada).
  const distinctProductVariantIds = [...new Set(lines.filter((l) => l.productVariantId).map((l) => l.productVariantId))];
  const singleProductVariantId = distinctProductVariantIds.length === 1 ? distinctProductVariantIds[0] : null;

  const issueDate = new Date(data.issueDate);
  const dueDate = calculateDueDate(issueDate, customer.paymentTermsDays);

  // Punto 2: límite de crédito y bloqueo por atraso — se valida ANTES
  // de tocar Fiscal, para no dejar nada a medias si se rechaza. Se
  // estima el total (subtotal + impuesto - retención) resolviendo la
  // MISMA tasa que va a usar el motor fiscal, sin volver a calcular
  // nada distinto — Fiscal la vuelve a resolver al postear, es una
  // lectura sin efectos secundarios, no una duplicación de lógica.
  const { currentOpenBalance, maxDaysOverdueFound } = await getCustomerCreditSnapshot(companyId, customer.id);
  let estimatedTotal = subtotal;
  if (!data.taxRateId || !data.withholdingRateId) {
    const { taxRate, withholdingRate } = await taxRatesService.resolveApplicableTax(companyId, {
      jurisdictionId: data.jurisdictionId,
      transactionType: 'SALE',
      date: issueDate,
    });
    const estimatedTax = taxRate ? subtotal.times(taxRate.rate).dividedBy(100) : new Decimal(0);
    const estimatedWithholding = withholdingRate ? subtotal.times(withholdingRate.rate).dividedBy(100) : new Decimal(0);
    estimatedTotal = subtotal.plus(estimatedTax).minus(estimatedWithholding);
  }
  assertCustomerCreditOk({
    customer,
    currentOpenBalance,
    newInvoiceAmount: estimatedTotal,
    maxDaysOverdueFound,
  });

  // Punto de integración con Fiscal: la misma pieza que ya calcula
  // impuesto/retención, corre las validaciones preventivas y postea el
  // asiento balanceado — no se duplica nada de eso acá. Fase 1: Fiscal,
  // el Ledger y la factura ahora comparten una sola transacción (antes
  // eran 3 independientes: si algo fallaba a mitad de camino podía
  // quedar un asiento sin FiscalTransaction, o una FiscalTransaction sin
  // factura).
  return withTransaction(async (tx) => {
    const fiscalTransaction = await fiscalTransactionsService.createFiscalTransaction(
      companyId,
      userId,
      {
        type: 'SALE',
        jurisdictionId: data.jurisdictionId,
        date: issueDate,
        taxBase: subtotal,
        taxBaseAccountId: data.incomeAccountId,
        counterpartyAccountId: receivableGlAccountId,
        counterpartyName: customer.name,
        counterpartyTaxId: customer.taxId || '',
        documentNumber: data.documentNumber || null,
        description: `Factura de venta — ${customer.name}`,
        taxRateId: data.taxRateId,
        withholdingRateId: data.withholdingRateId,
      },
      tx
    );

    // F17-E16: etiqueta la línea de ingreso con la FpaDimension del
    // producto (ver comentario en la resolución de
    // `singleProductVariantId`, arriba) — reutiliza exactamente el
    // mismo helper que ya usa Inventario para el lado del costo, así
    // nunca hay dos FpaDimension distintas para el mismo producto.
    if (singleProductVariantId) {
      const variant = await tx.productVariant.findUnique({
        where: { id: singleProductVariantId },
        include: { product: true },
      });
      const incomeLine = fiscalTransaction.journalEntryLines.find(
        (line) => line.accountId === data.incomeAccountId && Number(line.credit) > 0
      );
      if (variant && incomeLine) {
        const fpaDimensionId = await inventoryMovementsService.resolveProductFpaDimension(tx, companyId, variant.product);
        await tx.journalEntryLineFpaDimension.create({ data: { lineId: incomeLine.id, fpaDimensionId } });
      }
    }

    const invoiceNumber = await arApSettingsService.getNextArInvoiceNumber(companyId, tx);
    const totalAmount = subtotal.plus(fiscalTransaction.taxAmount).minus(fiscalTransaction.withholdingAmount);

    const invoice = await tx.arInvoice.create({
      data: {
        companyId,
        customerId: customer.id,
        invoiceNumber,
        issueDate,
        dueDate,
        jurisdictionId: data.jurisdictionId,
        incomeAccountId: data.incomeAccountId,
        fiscalTransactionId: fiscalTransaction.id,
        subtotal,
        taxAmount: fiscalTransaction.taxAmount,
        withholdingAmount: fiscalTransaction.withholdingAmount,
        totalAmount,
        salesOrderId: data.salesOrderId || null,
        createdByUserId: userId,
        lines: {
          create: lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount,
            amount: line.amount,
            order: line.order,
            productVariantId: line.productVariantId,
            warehouseId: line.warehouseId,
            salesOrderLineId: line.salesOrderLineId,
            unitCost: line.unitCost,
          })),
        },
      },
      include: { lines: true },
    });

    // Fase 3: recién con la factura y sus líneas ya creadas se puede
    // (a) disparar la salida real de inventario de las líneas de venta
    // directa/rápida (referencia la factura recién creada, dentro de
    // esta misma transacción — no una segunda), y (b) marcar cuánto de
    // cada línea de Pedido ya quedó facturado.
    let needsRefresh = false;
    for (const line of lines) {
      const createdLine = invoice.lines.find((l) => l.order === line.order);
      if (line.needsDirectExit) {
        const movement = await inventoryMovementsService.createExit(
          companyId,
          userId,
          {
            variantId: line.productVariantId,
            warehouseId: line.warehouseId,
            quantity: line.quantity,
            date: issueDate,
            type: 'SALE_EXIT',
            referenceType: 'ArInvoice',
            referenceId: invoice.id,
          },
          tx
        );
        await tx.arInvoiceLine.update({ where: { id: createdLine.id }, data: { unitCost: movement.unitCost } });
        needsRefresh = true;
      } else if (line.salesOrderLineId) {
        await tx.salesOrderLine.update({
          where: { id: line.salesOrderLineId },
          data: { invoicedQuantity: { increment: line.quantity } },
        });
      }
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'ar_invoice.created',
        entityType: 'ArInvoice',
        entityId: invoice.id,
        oldValue: null,
        newValue: invoice,
      },
      tx
    );

    // El objeto ya creado (`invoice.lines`) quedó desactualizado para
    // las líneas de salida directa (su `unitCost` se llenó DESPUÉS de
    // crearlas) — se relee una vez más, dentro de la misma transacción,
    // para que lo que devuelve `createInvoice` sea siempre exactamente
    // lo que quedó guardado, nunca una foto vieja.
    if (needsRefresh) {
      return tx.arInvoice.findUnique({ where: { id: invoice.id }, include: { lines: true } });
    }

    return invoice;
  }, tx);
}

async function getInvoice(companyId, id) {
  const invoice = await prisma.arInvoice.findFirst({
    where: { id, companyId },
    include: { lines: true, customer: true, fiscalTransaction: true, paymentApplications: { include: { payment: true } } },
  });
  if (!invoice) {
    throw new AppError('La factura indicada no existe.', 404, 'INVOICE_NOT_FOUND');
  }
  return invoice;
}

async function listInvoices(companyId, { customerId, status, from, to } = {}) {
  return prisma.arInvoice.findMany({
    where: {
      companyId,
      customerId: customerId || undefined,
      status: status || undefined,
      issueDate: from || to ? { gte: from, lte: to } : undefined,
    },
    include: { customer: true },
    orderBy: { issueDate: 'desc' },
  });
}

// Comportamiento de ventas para el gráfico del Panel principal: total
// facturado y cantidad de facturas por mes, sobre los últimos `months`
// meses. Es una agregación de solo lectura sobre lo que AR ya guarda
// (mismo criterio que usa el Panel principal con el Estado de
// Resultados de Contabilidad para el gráfico de ingresos/egresos) — no
// recalcula ni duplica nada de lo que ya hace `createInvoice`.
async function getSalesTrend(companyId, { months = 6 } = {}) {
  const referenceDate = new Date();
  const rangeStart = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - (months - 1), 1));

  const invoices = await prisma.arInvoice.findMany({
    where: { companyId, issueDate: { gte: rangeStart } },
    select: { issueDate: true, totalAmount: true },
  });

  return buildSalesTrend(invoices, months, referenceDate);
}

module.exports = { createInvoice, getInvoice, listInvoices, getSalesTrend };
