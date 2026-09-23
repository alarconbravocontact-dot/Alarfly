// Entrega de venta (punto 14): el hecho físico/logístico. Al
// confirmarse, dispara la salida real de inventario llamando al motor
// de valoración YA EXISTENTE (`inventory-movements.service.createExit`,
// extendido en esta fase para aceptar la transacción externa — nunca
// reimplementado acá). Siempre ligada a un Pedido: es la pieza del
// ciclo COMPLETO (Pedido → Reserva → Entrega → Inventario → Factura);
// la venta directa/rápida sin pedido dispara el inventario desde la
// propia factura (ver ar-invoices.service), no desde acá.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const inventoryMovementsService = require('../../inventory/services/inventory-movements.service');
const inventoryReservationsService = require('./inventory-reservations.service');
const salesOrdersService = require('./sales-orders.service');
const { remainingToDeliver } = require('./sales-orders.rules');

const { Decimal } = Prisma;

async function createSalesDelivery(companyId, userId, data) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: data.orderId, companyId },
    include: { lines: true },
  });
  if (!order) {
    throw new AppError('El pedido indicado no existe.', 404, 'SALES_ORDER_NOT_FOUND');
  }
  if (order.status === 'CANCELLED') {
    throw new AppError('No se puede entregar un pedido cancelado.', 409, 'SALES_ORDER_CANCELLED');
  }
  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new AppError('La entrega necesita al menos una línea.', 400, 'DELIVERY_LINES_REQUIRED');
  }

  const linesByOrderLineId = new Map(order.lines.map((line) => [line.id, line]));
  const lines = data.lines.map((raw) => {
    const orderLine = linesByOrderLineId.get(raw.orderLineId);
    if (!orderLine) {
      throw new AppError('Una de las líneas de entrega no corresponde a este pedido.', 400, 'ORDER_LINE_NOT_FOUND');
    }
    const quantity = new Decimal(raw.quantity);
    if (quantity.greaterThan(remainingToDeliver(orderLine))) {
      throw new AppError(
        `La línea "${orderLine.description}" solo tiene ${remainingToDeliver(orderLine).toFixed(4)} pendiente de entregar.`,
        400,
        'DELIVERY_EXCEEDS_ORDER_LINE'
      );
    }
    if (!orderLine.variantId) {
      throw new AppError('Solo se pueden entregar líneas con producto/variante asignada.', 400, 'DELIVERY_LINE_WITHOUT_VARIANT');
    }
    return { orderLineId: orderLine.id, variantId: orderLine.variantId, warehouseId: orderLine.warehouseId, quantity };
  });

  return prisma.$transaction(async (tx) => {
    const deliveryNumber = await arApSettingsService.getNextSalesDeliveryNumber(companyId, tx);
    const delivery = await tx.salesDelivery.create({
      data: {
        companyId,
        orderId: order.id,
        customerId: order.customerId,
        deliveryNumber,
        deliveryDate: new Date(data.deliveryDate),
        responsibleUserId: data.responsibleUserId || null,
        createdByUserId: userId,
        lines: { create: lines.map((line) => ({ orderLineId: line.orderLineId, variantId: line.variantId, warehouseId: line.warehouseId, quantity: line.quantity })) },
      },
      include: { lines: true },
    });

    await auditService.log(
      { companyId, userId, action: 'sales_delivery.created', entityType: 'SalesDelivery', entityId: delivery.id, oldValue: null, newValue: delivery },
      tx
    );

    return delivery;
  });
}

// Confirmar una entrega: TODO lo que pasa acá es una sola operación
// indivisible (punto 31) — salida real de inventario (con su asiento
// de COGS), liberación de la reserva convertida en cumplida, y
// actualización de lo entregado/costeado del pedido, todo o nada.
async function confirmDelivery(companyId, userId, deliveryId) {
  const delivery = await prisma.salesDelivery.findFirst({
    where: { id: deliveryId, companyId },
    include: { lines: true },
  });
  if (!delivery) {
    throw new AppError('La entrega indicada no existe.', 404, 'SALES_DELIVERY_NOT_FOUND');
  }
  if (delivery.status !== 'DRAFT') {
    throw new AppError('Solo se puede confirmar una entrega que está en borrador.', 409, 'SALES_DELIVERY_NOT_DRAFT');
  }

  return prisma.$transaction(async (tx) => {
    for (const line of delivery.lines) {
      const movement = await inventoryMovementsService.createExit(
        companyId,
        userId,
        {
          variantId: line.variantId,
          warehouseId: line.warehouseId,
          quantity: line.quantity,
          date: delivery.deliveryDate,
          type: 'SALE_EXIT',
          referenceType: 'SalesDelivery',
          referenceId: delivery.id,
        },
        tx
      );

      await tx.salesDeliveryLine.update({
        where: { id: line.id },
        data: { unitCost: movement.unitCost, inventoryMovementId: movement.id },
      });

      if (line.orderLineId) {
        const reservation = await inventoryReservationsService.getReservationForOrderLine(tx, line.orderLineId);
        if (reservation) {
          await inventoryReservationsService.fulfillReservation(tx, reservation, line.quantity);
        }
        await tx.salesOrderLine.update({
          where: { id: line.orderLineId },
          data: {
            deliveredQuantity: { increment: line.quantity },
            deliveredCostTotal: { increment: movement.totalCost },
          },
        });
      }
    }

    const updated = await tx.salesDelivery.update({ where: { id: delivery.id }, data: { status: 'CONFIRMED' } });

    if (delivery.orderId) {
      await salesOrdersService.recomputeOrderStatus(tx, delivery.orderId);
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'sales_delivery.confirmed',
        entityType: 'SalesDelivery',
        entityId: delivery.id,
        oldValue: { status: 'DRAFT' },
        newValue: { status: 'CONFIRMED' },
      },
      tx
    );

    return updated;
  });
}

// Una entrega en borrador nunca tocó inventario todavía — cancelarla
// es seguro. Una ya CONFIRMED ya generó una salida real y permanente
// (mismo criterio que el resto de Inventario: los movimientos no se
// revierten solos); se documenta como límite consciente, igual que la
// laguna de reversión de conciliación bancaria de Fase 1 — no se
// improvisa una reversión automática acá.
async function cancelDelivery(companyId, userId, deliveryId, reason) {
  const delivery = await prisma.salesDelivery.findFirst({ where: { id: deliveryId, companyId } });
  if (!delivery) {
    throw new AppError('La entrega indicada no existe.', 404, 'SALES_DELIVERY_NOT_FOUND');
  }
  if (delivery.status === 'CONFIRMED') {
    throw new AppError(
      'Esta entrega ya se confirmó y generó una salida real de inventario — no se puede cancelar. Registra un ajuste de inventario si el producto regresa físicamente.',
      409,
      'SALES_DELIVERY_ALREADY_CONFIRMED'
    );
  }
  if (delivery.status === 'CANCELLED') {
    throw new AppError('Esta entrega ya está cancelada.', 409, 'SALES_DELIVERY_ALREADY_CANCELLED');
  }
  if (!reason) {
    throw new AppError('Cancelar una entrega necesita un motivo.', 400, 'CANCELLATION_REASON_REQUIRED');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.salesDelivery.update({ where: { id: delivery.id }, data: { status: 'CANCELLED' } });
    await auditService.log(
      { companyId, userId, action: 'sales_delivery.cancelled', entityType: 'SalesDelivery', entityId: delivery.id, oldValue: { status: 'DRAFT' }, newValue: { status: 'CANCELLED', reason } },
      tx
    );
    return updated;
  });
}

async function getSalesDelivery(companyId, id) {
  const delivery = await prisma.salesDelivery.findFirst({
    where: { id, companyId },
    include: { customer: true, order: true, lines: { include: { variant: { include: { product: true } }, warehouse: true } } },
  });
  if (!delivery) {
    throw new AppError('La entrega indicada no existe.', 404, 'SALES_DELIVERY_NOT_FOUND');
  }
  return delivery;
}

async function listSalesDeliveries(companyId, { orderId, customerId, status } = {}) {
  return prisma.salesDelivery.findMany({
    where: { companyId, orderId: orderId || undefined, customerId: customerId || undefined, status: status || undefined },
    include: { customer: true, order: true },
    orderBy: { deliveryDate: 'desc' },
  });
}

module.exports = { createSalesDelivery, confirmDelivery, cancelDelivery, getSalesDelivery, listSalesDeliveries };
