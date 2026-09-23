const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { getExporter } = require('./exporters');

async function createBatch(companyId, userId, data) {
  const treasuryAccount = await prisma.treasuryAccount.findFirst({
    where: { id: data.treasuryAccountId, companyId },
  });
  if (!treasuryAccount) {
    throw new AppError('La cuenta de tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const batch = await tx.paymentBatch.create({ data: { companyId, createdByUserId: userId, ...data } });
    await auditService.log(
      { companyId, userId, action: 'payment_batch.created', entityType: 'PaymentBatch', entityId: batch.id, oldValue: null, newValue: batch },
      tx
    );
    return batch;
  });
}

async function addOrderToBatch(companyId, batchId, userId, paymentOrderId) {
  const batch = await prisma.paymentBatch.findFirst({ where: { id: batchId, companyId } });
  if (!batch) {
    throw new AppError('El lote de pago indicado no existe.', 404, 'PAYMENT_BATCH_NOT_FOUND');
  }
  if (batch.status !== 'OPEN') {
    throw new AppError('Solo se pueden agregar órdenes a un lote abierto.', 409, 'BATCH_NOT_OPEN');
  }

  const order = await prisma.paymentOrder.findFirst({ where: { id: paymentOrderId, companyId } });
  if (!order) {
    throw new AppError('La orden de pago indicada no existe.', 404, 'PAYMENT_ORDER_NOT_FOUND');
  }
  if (order.treasuryAccountId !== batch.treasuryAccountId) {
    throw new AppError('La orden debe ser de la misma cuenta de tesorería que el lote.', 400, 'TREASURY_ACCOUNT_MISMATCH');
  }
  if (order.batchId) {
    throw new AppError('Esta orden ya pertenece a otro lote.', 409, 'ORDER_ALREADY_IN_BATCH');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentOrder.update({ where: { id: paymentOrderId }, data: { batchId } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_batch.order_added',
        entityType: 'PaymentBatch',
        entityId: batchId,
        oldValue: null,
        newValue: { paymentOrderId },
      },
      tx
    );
    return updated;
  });
}

async function removeOrderFromBatch(companyId, batchId, userId, paymentOrderId) {
  const order = await prisma.paymentOrder.findFirst({ where: { id: paymentOrderId, companyId, batchId } });
  if (!order) {
    throw new AppError('Esa orden no pertenece a este lote.', 404, 'PAYMENT_ORDER_NOT_IN_BATCH');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentOrder.update({ where: { id: paymentOrderId }, data: { batchId: null } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_batch.order_removed',
        entityType: 'PaymentBatch',
        entityId: batchId,
        oldValue: { paymentOrderId },
        newValue: null,
      },
      tx
    );
    return updated;
  });
}

// Exporta el lote (genera el archivo de pago) solo si TODAS las órdenes
// ya están totalmente aprobadas. Marca el lote como exportado y cada
// orden como pagada — el efecto contable ya ocurrió al aprobarse, esto
// solo deja constancia operativa de que se envió al banco.
async function exportBatch(companyId, batchId, userId) {
  const batch = await prisma.paymentBatch.findFirst({
    where: { id: batchId, companyId },
    include: { paymentOrders: true },
  });
  if (!batch) {
    throw new AppError('El lote de pago indicado no existe.', 404, 'PAYMENT_BATCH_NOT_FOUND');
  }
  if (batch.status !== 'OPEN') {
    throw new AppError('Este lote ya fue exportado o está cancelado.', 409, 'BATCH_NOT_OPEN');
  }
  if (batch.paymentOrders.length === 0) {
    throw new AppError('El lote no tiene órdenes de pago.', 400, 'EMPTY_BATCH');
  }

  const notApproved = batch.paymentOrders.filter((o) => o.status !== 'APPROVED');
  if (notApproved.length > 0) {
    throw new AppError(
      `Hay ${notApproved.length} orden(es) en el lote que todavía no están totalmente aprobadas.`,
      409,
      'BATCH_HAS_UNAPPROVED_ORDERS'
    );
  }

  const exporter = getExporter(batch.exportFormat);
  const csv = exporter(batch.paymentOrders);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentBatch.update({
      where: { id: batchId },
      data: { status: 'EXPORTED', exportedAt: new Date() },
    });
    await tx.paymentOrder.updateMany({ where: { batchId }, data: { status: 'PAID' } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_batch.exported',
        entityType: 'PaymentBatch',
        entityId: batchId,
        oldValue: { status: 'OPEN' },
        newValue: { status: 'EXPORTED', ordersCount: batch.paymentOrders.length },
      },
      tx
    );
    return { batch: updated, file: csv };
  });
}

async function listBatches(companyId, { status } = {}) {
  return prisma.paymentBatch.findMany({
    where: { companyId, status: status || undefined },
    orderBy: { createdAt: 'desc' },
  });
}

async function getBatch(companyId, id) {
  const batch = await prisma.paymentBatch.findFirst({ where: { id, companyId }, include: { paymentOrders: true } });
  if (!batch) {
    throw new AppError('El lote de pago indicado no existe.', 404, 'PAYMENT_BATCH_NOT_FOUND');
  }
  return batch;
}

module.exports = { createBatch, addOrderToBatch, removeOrderFromBatch, exportBatch, listBatches, getBatch };
