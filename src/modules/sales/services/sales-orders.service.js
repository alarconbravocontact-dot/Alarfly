// Pedido de venta (punto 8): representa una intención/orden comercial,
// con estado COMERCIAL propio (DRAFT/CONFIRMED/PARTIALLY_DELIVERED/
// DELIVERED/CANCELLED) — nunca se mezcla con el estado financiero de
// la factura (ArInvoiceStatus, sin tocar) ni con el fiscal
// (FiscalTransaction, sin tocar). El Pedido es completamente opcional:
// una factura directa (ar-invoices.service.createInvoice) sigue
// funcionando exactamente igual sin pasar por acá (punto 19).
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { withTransaction } = require('../../../core/database/unit-of-work');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const inventoryReservationsService = require('./inventory-reservations.service');
const { calculateLineAmount, determineOrderStatus } = require('./sales-orders.rules');

const { Decimal } = Prisma;

async function loadVariantForLine(companyId, variantId) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, product: { companyId } },
    include: { product: true },
  });
  if (!variant) {
    throw new AppError('La variante de producto indicada no existe.', 404, 'PRODUCT_VARIANT_NOT_FOUND');
  }
  return variant;
}

// Una línea "física" es la que tiene variante Y esa variante es de un
// producto que NO es un servicio (punto 11) — un servicio se factura
// igual (con su propia variante, todo producto siempre tiene una) pero
// nunca reserva/entrega/consume inventario.
function isPhysicalLine(variant) {
  return Boolean(variant) && !variant.product.isService;
}

async function buildLines(companyId, rawLines) {
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    let variant = null;
    if (raw.variantId) {
      variant = await loadVariantForLine(companyId, raw.variantId);
      if (isPhysicalLine(variant) && !raw.warehouseId) {
        throw new AppError(
          `La línea ${i + 1} es de un producto físico y necesita indicar el almacén.`,
          400,
          'WAREHOUSE_REQUIRED_FOR_PHYSICAL_LINE'
        );
      }
    }
    const amount = calculateLineAmount(raw.quantity, raw.unitPrice, raw.discount);
    lines.push({
      variantId: raw.variantId || null,
      warehouseId: variant && isPhysicalLine(variant) ? raw.warehouseId : raw.warehouseId || null,
      description: raw.description,
      quantity: new Decimal(raw.quantity),
      unitPrice: new Decimal(raw.unitPrice),
      discount: new Decimal(raw.discount || 0),
      amount,
      sortOrder: i,
      isPhysical: isPhysicalLine(variant),
    });
  }
  return lines;
}

async function createSalesOrder(companyId, userId, data) {
  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId, isActive: true } });
  if (!customer) {
    throw new AppError('El cliente indicado no existe o está inactivo.', 404, 'CUSTOMER_NOT_FOUND');
  }
  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new AppError('El pedido necesita al menos una línea.', 400, 'ORDER_LINES_REQUIRED');
  }

  const lines = await buildLines(companyId, data.lines);

  return withTransaction(async (tx) => {
    const orderNumber = await arApSettingsService.getNextSalesOrderNumber(companyId, tx);

    const order = await tx.salesOrder.create({
      data: {
        companyId,
        customerId: customer.id,
        orderNumber,
        orderDate: new Date(data.orderDate),
        notes: data.notes || null,
        createdByUserId: userId,
        lines: {
          create: lines.map(({ isPhysical, ...line }) => line), // eslint-disable-line no-unused-vars
        },
      },
      include: { lines: true },
    });

    await auditService.log(
      { companyId, userId, action: 'sales_order.created', entityType: 'SalesOrder', entityId: order.id, oldValue: null, newValue: order },
      tx
    );

    return order;
  });
}

// Confirmar reserva stock para cada línea física (punto 8/12) — si
// CUALQUIER línea no tiene disponible suficiente, toda la confirmación
// se revierte (una sola transacción): no tiene sentido reservar la
// mitad de un pedido.
async function confirmSalesOrder(companyId, userId, orderId) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, companyId },
    include: { lines: { include: { variant: { include: { product: true } } } } },
  });
  if (!order) {
    throw new AppError('El pedido indicado no existe.', 404, 'SALES_ORDER_NOT_FOUND');
  }
  if (order.status !== 'DRAFT') {
    throw new AppError('Solo se puede confirmar un pedido que está en borrador.', 409, 'SALES_ORDER_NOT_DRAFT');
  }

  return prisma.$transaction(async (tx) => {
    for (const line of order.lines) {
      if (line.variant && !line.variant.product.isService) {
        await inventoryReservationsService.reserveForOrderLine(tx, companyId, {
          orderLineId: line.id,
          variantId: line.variantId,
          warehouseId: line.warehouseId,
          quantity: line.quantity,
        });
      }
    }

    const updated = await tx.salesOrder.update({ where: { id: order.id }, data: { status: 'CONFIRMED' } });

    await auditService.log(
      { companyId, userId, action: 'sales_order.confirmed', entityType: 'SalesOrder', entityId: order.id, oldValue: { status: 'DRAFT' }, newValue: { status: 'CONFIRMED' } },
      tx
    );

    return updated;
  });
}

async function cancelSalesOrder(companyId, userId, orderId, reason) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, companyId },
    include: { lines: true },
  });
  if (!order) {
    throw new AppError('El pedido indicado no existe.', 404, 'SALES_ORDER_NOT_FOUND');
  }
  if (order.status === 'CANCELLED') {
    throw new AppError('Este pedido ya está cancelado.', 409, 'SALES_ORDER_ALREADY_CANCELLED');
  }
  if (order.status === 'DELIVERED') {
    throw new AppError('No se puede cancelar un pedido ya entregado por completo.', 409, 'SALES_ORDER_ALREADY_DELIVERED');
  }
  if (!reason) {
    throw new AppError('Cancelar un pedido necesita un motivo.', 400, 'CANCELLATION_REASON_REQUIRED');
  }

  return prisma.$transaction(async (tx) => {
    for (const line of order.lines) {
      const reservation = await inventoryReservationsService.getReservationForOrderLine(tx, line.id);
      if (reservation && (reservation.status === 'RESERVED' || reservation.status === 'PARTIALLY_RELEASED')) {
        const remaining = new Decimal(reservation.quantity).minus(reservation.releasedQuantity);
        await inventoryReservationsService.releaseReservation(tx, reservation, remaining, { cancel: true });
      }
    }

    const updated = await tx.salesOrder.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'sales_order.cancelled',
        entityType: 'SalesOrder',
        entityId: order.id,
        oldValue: { status: order.status },
        newValue: { status: 'CANCELLED', reason },
      },
      tx
    );

    return updated;
  });
}

// Recalcula el estado comercial del pedido a partir de cuánto se
// entregó de cada línea — llamado por sales-deliveries.service al
// confirmar una entrega (nunca se pisa a mano). Un pedido ya
// CANCELLED nunca se reactiva por esto.
async function recomputeOrderStatus(tx, orderId) {
  const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { lines: true } });
  if (!order || order.status === 'CANCELLED') return order;

  const physicalLines = order.lines.filter((line) => line.warehouseId);
  const status = physicalLines.length > 0 ? determineOrderStatus(physicalLines) : order.status;
  if (status === order.status) return order;

  return tx.salesOrder.update({ where: { id: orderId }, data: { status } });
}

async function getSalesOrder(companyId, id) {
  const order = await prisma.salesOrder.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      lines: { include: { variant: { include: { product: true } }, warehouse: true }, orderBy: { sortOrder: 'asc' } },
      deliveries: { include: { lines: true } },
      invoices: true,
    },
  });
  if (!order) {
    throw new AppError('El pedido indicado no existe.', 404, 'SALES_ORDER_NOT_FOUND');
  }
  return order;
}

async function listSalesOrders(companyId, { customerId, status } = {}) {
  return prisma.salesOrder.findMany({
    where: { companyId, customerId: customerId || undefined, status: status || undefined },
    include: { customer: true },
    orderBy: { orderDate: 'desc' },
  });
}

module.exports = {
  createSalesOrder,
  confirmSalesOrder,
  cancelSalesOrder,
  recomputeOrderStatus,
  getSalesOrder,
  listSalesOrders,
};
