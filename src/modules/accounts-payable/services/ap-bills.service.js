// Espejo exacto de accounts-receivable/services/ar-invoices.service.js
// del lado de facturas de compra (Purchase).
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const fiscalTransactionsService = require('../../fiscal/services/fiscal-transactions.service');
const inventoryMovementsService = require('../../inventory/services/inventory-movements.service');
const { calculateDueDate } = require('./ap-bills.rules');
const { calculateLineAmount } = require('../../sales/services/sales-orders.rules');
const { averageReceivedUnitCost, remainingToBill } = require('../../inventory/services/purchase-orders.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');

const { Decimal } = Prisma;

// Fase 4 (Compras): espejo de ar-invoices.service.resolveLine — resuelve
// ANTES de tocar Fiscal/Ledger qué hace falta cada línea con producto
// real. 3 casos, igual criterio que Ventas:
//  1. Sin variantId: línea de texto de siempre, sin cambios.
//  2. Con variantId de un servicio: se factura igual, nunca toca
//     inventario (un servicio no tiene stock que recibir).
//  3. Con variantId de un producto físico:
//     a) Con purchaseOrderLineId: la mercancía YA se recibió (vía
//        purchase-orders.service.receivePurchaseOrder, que ya generó su
//        propia entrada de inventario) — nunca se vuelve a mover
//        inventario acá, solo se usa el costo real recibido
//        (averageReceivedUnitCost) y se valida que no se facture más de
//        lo recibido y sin facturar (remainingToBill). El asiento de
//        esta línea (dentro de la factura, vía Fiscal) es el cierre
//        documentario/contable normal de "ya me llegó, ahora me llega
//        la factura" — no se duplica el movimiento físico.
//     b) Sin purchaseOrderLineId (compra directa, sin orden previa): la
//        línea SÍ genera una entrada real de inventario, dentro de esta
//        misma factura — se resuelve más abajo, una vez que la factura
//        y sus líneas ya existan (createEntry necesita poder
//        referenciarlas), igual patrón que needsDirectExit en Ventas.
async function resolveLine(companyId, raw, index) {
  const quantity = new Decimal(raw.quantity ?? 1);
  const unitPrice = new Decimal(raw.unitPrice);
  const discount = new Decimal(raw.discount || 0);
  const amount = calculateLineAmount(quantity, unitPrice, discount);

  const base = { description: raw.description, quantity, unitPrice, discount, amount, order: index };

  if (!raw.variantId) {
    return { ...base, productVariantId: null, warehouseId: null, purchaseOrderLineId: null, unitCost: null, needsDirectEntry: false };
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id: raw.variantId, product: { companyId } },
    include: { product: true },
  });
  if (!variant) {
    throw new AppError(`La línea ${index + 1} referencia una variante de producto que no existe.`, 404, 'PRODUCT_VARIANT_NOT_FOUND');
  }

  if (variant.product.isService) {
    return { ...base, productVariantId: variant.id, warehouseId: null, purchaseOrderLineId: null, unitCost: null, needsDirectEntry: false };
  }

  if (raw.purchaseOrderLineId) {
    const orderLine = await prisma.purchaseOrderLine.findFirst({
      where: { id: raw.purchaseOrderLineId, purchaseOrder: { companyId } },
      include: { purchaseOrder: true },
    });
    if (!orderLine) {
      throw new AppError(`La línea ${index + 1} referencia una línea de orden de compra que no existe.`, 404, 'PURCHASE_ORDER_LINE_NOT_FOUND');
    }
    const available = remainingToBill(orderLine);
    if (quantity.greaterThan(available)) {
      throw new AppError(
        `La línea "${variant.sku}" de la orden solo tiene ${available.toFixed(4)} recibido y sin facturar.`,
        400,
        'BILL_EXCEEDS_RECEIVED_QUANTITY'
      );
    }
    const unitCost = averageReceivedUnitCost(orderLine);
    return {
      ...base,
      productVariantId: variant.id,
      warehouseId: orderLine.purchaseOrder.warehouseId,
      purchaseOrderLineId: orderLine.id,
      unitCost,
      needsDirectEntry: false,
    };
  }

  if (!raw.warehouseId) {
    throw new AppError(`La línea ${index + 1} es de un producto físico y necesita indicar el almacén.`, 400, 'WAREHOUSE_REQUIRED_FOR_PHYSICAL_LINE');
  }
  return { ...base, productVariantId: variant.id, warehouseId: raw.warehouseId, purchaseOrderLineId: null, unitCost: null, needsDirectEntry: true };
}

// `tx` (Fase 1 — Unit of Work; mismo patrón opcional que ya usa
// ar-invoices.service.createInvoice): opcional, para componer esta
// factura dentro de una transacción externa más grande si algún
// llamador futuro lo necesita. Si no se pasa, se comporta igual que
// siempre.
async function createBill(companyId, userId, data, tx = null) {
  const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, companyId, isActive: true } });
  if (!vendor) {
    throw new AppError('El proveedor indicado no existe o está inactivo.', 404, 'VENDOR_NOT_FOUND');
  }

  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new AppError('La factura necesita al menos una línea.', 400, 'BILL_LINES_REQUIRED');
  }

  const payableGlAccountId = await arApSettingsService.assertPayableAccountConfigured(companyId);

  const lines = [];
  for (let i = 0; i < data.lines.length; i++) {
    lines.push(await resolveLine(companyId, data.lines[i], i));
  }
  const subtotal = lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));

  const issueDate = new Date(data.issueDate);
  const dueDate = calculateDueDate(issueDate, vendor.paymentTermsDays);

  // Fase 1: igual que en AR, Fiscal + Ledger + factura quedan en una
  // sola transacción.
  return withTransaction(async (tx) => {
    const fiscalTransaction = await fiscalTransactionsService.createFiscalTransaction(
      companyId,
      userId,
      {
        type: 'PURCHASE',
        jurisdictionId: data.jurisdictionId,
        date: issueDate,
        taxBase: subtotal,
        taxBaseAccountId: data.expenseAccountId,
        counterpartyAccountId: payableGlAccountId,
        counterpartyName: vendor.name,
        counterpartyTaxId: vendor.taxId || '',
        documentNumber: data.documentNumber || null,
        description: `Factura de compra — ${vendor.name}`,
        taxRateId: data.taxRateId,
        withholdingRateId: data.withholdingRateId,
      },
      tx
    );

    const billNumber = await arApSettingsService.getNextApBillNumber(companyId, tx);
    const totalAmount = subtotal.plus(fiscalTransaction.taxAmount).minus(fiscalTransaction.withholdingAmount);

    const bill = await tx.apBill.create({
      data: {
        companyId,
        vendorId: vendor.id,
        billNumber,
        issueDate,
        dueDate,
        jurisdictionId: data.jurisdictionId,
        expenseAccountId: data.expenseAccountId,
        fiscalTransactionId: fiscalTransaction.id,
        subtotal,
        taxAmount: fiscalTransaction.taxAmount,
        withholdingAmount: fiscalTransaction.withholdingAmount,
        totalAmount,
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
            purchaseOrderLineId: line.purchaseOrderLineId,
            unitCost: line.unitCost,
          })),
        },
      },
      include: { lines: true },
    });

    // Fase 4: recién con la factura y sus líneas ya creadas se puede
    // (a) disparar la entrada real de inventario de las líneas de compra
    // directa sin orden previa — su contraparte contable es la misma
    // expenseAccountId que la transacción fiscal ya debitó para el
    // subtotal completo: al debitar Inventario/acreditar expenseAccountId
    // acá, ese débito fiscal queda neteado en cero y el efecto combinado
    // termina siendo el correcto (débito Inventario, crédito Cuentas por
    // Pagar) sin inventar una cuenta nueva ni pedirle una al usuario —, y
    // (b) marcar cuánto de cada línea de orden ya quedó facturado.
    let needsRefresh = false;
    for (const line of lines) {
      const createdLine = bill.lines.find((l) => l.order === line.order);
      if (line.needsDirectEntry) {
        const movement = await inventoryMovementsService.createEntry(
          companyId,
          userId,
          {
            variantId: line.productVariantId,
            warehouseId: line.warehouseId,
            quantity: line.quantity,
            unitCost: line.amount.dividedBy(line.quantity),
            date: issueDate,
            type: 'PURCHASE_ENTRY',
            counterpartyAccountId: data.expenseAccountId,
            referenceType: 'ApBill',
            referenceId: bill.id,
          },
          tx
        );
        await tx.apBillLine.update({ where: { id: createdLine.id }, data: { unitCost: movement.unitCost } });
        needsRefresh = true;
      } else if (line.purchaseOrderLineId) {
        await tx.purchaseOrderLine.update({
          where: { id: line.purchaseOrderLineId },
          data: { billedQuantity: { increment: line.quantity } },
        });
      }
    }

    await auditService.log(
      { companyId, userId, action: 'ap_bill.created', entityType: 'ApBill', entityId: bill.id, oldValue: null, newValue: bill },
      tx
    );

    // Igual criterio que AR: el objeto ya creado quedó desactualizado
    // para las líneas de entrada directa (su unitCost se llenó DESPUÉS
    // de crearlas) — se relee una vez más, dentro de la misma
    // transacción, para que lo que devuelve createBill sea siempre
    // exactamente lo que quedó guardado.
    if (needsRefresh) {
      return tx.apBill.findUnique({ where: { id: bill.id }, include: { lines: true } });
    }

    return bill;
  }, tx);
}

async function getBill(companyId, id) {
  const bill = await prisma.apBill.findFirst({
    where: { id, companyId },
    include: { lines: true, vendor: true, fiscalTransaction: true, paymentApplications: { include: { payment: true } } },
  });
  if (!bill) {
    throw new AppError('La factura indicada no existe.', 404, 'BILL_NOT_FOUND');
  }
  return bill;
}

async function listBills(companyId, { vendorId, status, from, to } = {}) {
  return prisma.apBill.findMany({
    where: {
      companyId,
      vendorId: vendorId || undefined,
      status: status || undefined,
      issueDate: from || to ? { gte: from, lte: to } : undefined,
    },
    include: { vendor: true },
    orderBy: { issueDate: 'desc' },
  });
}

module.exports = { createBill, getBill, listBills };
