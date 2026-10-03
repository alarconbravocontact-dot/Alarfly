// Movimientos de Inventario (punto 4): entradas, salidas (con
// explosión de BOM) y ajustes. Todo movimiento que afecta el VALOR del
// inventario postea su asiento llamando a core/ledger.postEntry (nunca
// un motor de asientos propio). Fase 1: el asiento y la escritura propia
// del módulo (movimiento, capas de costo, etiqueta FP&A, auditoría)
// comparten una sola transacción — antes eran dos independientes.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const valuationService = require('./valuation.service');
const inventorySettingsService = require('./inventory-settings.service');
const { explodeBomComponents } = require('./bom.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');

const { Decimal } = Prisma;

async function loadVariantWithProduct(companyId, variantId) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, product: { companyId } },
    include: { product: { include: { category: true } } },
  });
  if (!variant) {
    throw new AppError('La variante de producto indicada no existe.', 404, 'PRODUCT_VARIANT_NOT_FOUND');
  }
  return variant;
}

async function assertWarehouse(companyId, warehouseId) {
  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId, isActive: true } });
  if (!warehouse) {
    throw new AppError('El almacén indicado no existe o está inactivo.', 404, 'WAREHOUSE_NOT_FOUND');
  }
  return warehouse;
}

async function resolveOrCreateLot(companyId, variantId, lotNumber, expirationDate) {
  if (!lotNumber) return null;
  return prisma.inventoryLot.upsert({
    where: { variantId_lotNumber: { variantId, lotNumber } },
    update: { expirationDate: expirationDate || undefined },
    create: { companyId, variantId, lotNumber, expirationDate: expirationDate || null, isSerialNumber: false },
  });
}

// Punto 7 (Costo real → Rentabilidad): la primera vez que un producto
// se vende, se le crea (y se le recuerda) una FpaDimension tipo
// PRODUCT propia — así el reporte de Rentabilidad por Producto de
// Reportes (que ya agrupa por FpaDimension vía
// JournalEntryLineFpaDimension) lee el costo real sin que Inventario
// tenga que exponer/duplicar ese cálculo allá.
async function resolveProductFpaDimension(tx, companyId, product) {
  if (product.fpaDimensionId) return product.fpaDimensionId;
  const dimension = await tx.fpaDimension.create({ data: { companyId, type: 'PRODUCT', name: product.name } });
  await tx.product.update({ where: { id: product.id }, data: { fpaDimensionId: dimension.id } });
  return dimension.id;
}

// Etiqueta la línea de costo de venta (débito a la cuenta COGS) del
// asiento recién posteado con la FpaDimension del producto — nunca
// las líneas de crédito (esas son movimiento de activo de inventario,
// no ingreso/gasto directo, así que no le interesan a Rentabilidad).
async function tagCogsLineWithProduct(tx, companyId, product, journalEntryLines, cogsAccountId) {
  const cogsLine = journalEntryLines.find((line) => line.accountId === cogsAccountId && Number(line.debit) > 0);
  if (!cogsLine) return;
  const fpaDimensionId = await resolveProductFpaDimension(tx, companyId, product);
  await tx.journalEntryLineFpaDimension.create({ data: { lineId: cogsLine.id, fpaDimensionId } });
}

// ENTRADA: compra o producción. `counterpartyAccountId` lo indica
// quien registra (ej. Cuentas por Pagar si es contra factura, Bancos
// si se pagó de contado) — no se asume ninguna cuenta por defecto,
// porque una entrada de inventario puede originarse de formas
// distintas que este módulo no decide por sí solo.
// `tx` (Fase 1 — Unit of Work; extendido en Fase 4 con el mismo patrón
// ya usado en createExit/createBomExit): opcional. Lo usa
// purchase-orders.service.receivePurchaseOrder para que cada línea
// recibida, la actualización de quantityReceived/receivedCostTotal y el
// estado de la orden queden en una sola transacción — antes eran
// independientes y un fallo a mitad de camino podía dejar inventario
// movido sin que la orden reflejara la recepción (o viceversa).
async function createEntry(companyId, userId, data, tx = null) {
  const variant = await loadVariantWithProduct(companyId, data.variantId);
  await assertWarehouse(companyId, data.warehouseId);

  const method = await valuationService.resolveValuationMethod(companyId, variant.product);
  const inventoryAssetAccountId = await valuationService.resolveInventoryAssetAccount(companyId, variant.product);

  const qty = new Decimal(data.quantity);
  const unitCost = new Decimal(data.unitCost);
  const totalCost = qty.times(unitCost).toDecimalPlaces(2);

  const lot = await resolveOrCreateLot(companyId, data.variantId, data.lotNumber, data.expirationDate);

  return withTransaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: data.date,
        description: `Entrada de inventario — ${variant.product.name} (${variant.sku})`,
        lines: [
          { accountId: inventoryAssetAccountId, debit: totalCost.toNumber(), credit: 0 },
          { accountId: data.counterpartyAccountId, debit: 0, credit: totalCost.toNumber() },
        ],
        origin: 'AUTOMATIC',
        sourceModule: 'inventory',
        sourceReference: data.referenceId || null,
        createdByUserId: userId,
        autoApprove: true,
      },
      tx
    );

    const movement = await tx.inventoryMovement.create({
      data: {
        companyId,
        variantId: data.variantId,
        warehouseId: data.warehouseId,
        type: data.type || 'PURCHASE_ENTRY',
        quantity: qty,
        unitCost,
        totalCost,
        date: data.date,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        purchaseOrderLineId: data.purchaseOrderLineId || null,
        lotId: lot?.id || null,
        journalEntryId: entry.id,
        notes: data.notes || null,
        createdByUserId: userId,
      },
    });

    await valuationService.applyEntry(tx, {
      companyId,
      variantId: data.variantId,
      warehouseId: data.warehouseId,
      quantity: qty,
      unitCost,
      movementId: movement.id,
      date: data.date,
      method,
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'inventory_movement.entry_created',
        entityType: 'InventoryMovement',
        entityId: movement.id,
        oldValue: null,
        newValue: movement,
      },
      tx
    );

    return movement;
  }, tx);
}

// SALIDA (venta/consumo). Si la variante tiene una Lista de Materiales
// activa, NO se toca el stock propio del padre (se trata como un kit
// virtual armado a partir de sus componentes en el momento de la
// venta): se explota el BOM y se descuenta cada componente, con un
// solo asiento contable que agrupa el costo de todos.
//
// `tx` (Fase 3 — Ventas): opcional, mismo patrón `tx`/`withTransaction`
// de Fase 1. Lo usa `sales-deliveries.service`/`ar-invoices.service`
// para que la salida real de inventario (con su asiento de COGS) quede
// en la MISMA transacción que la entrega/factura que la origina — así
// una venta de producto físico es una sola operación atómica, nunca
// dos. Si no se pasa, se comporta igual que siempre (transacción propia).
async function createExit(companyId, userId, data, tx = null) {
  // F17-E16: esta lectura ocurre ANTES de entrar al `withTransaction`
  // de más abajo — si `tx` ya existe (un llamador externo, ej.
  // ar-invoices.service, ya abrió la transacción), leer con el cliente
  // `prisma` plano no ve escrituras todavía sin confirmar hechas antes
  // en esa misma transacción (ej. `Product.fpaDimensionId`, si algo
  // más ya lo resolvió recién, en la misma transacción, un momento
  // antes) — causaba que `tagCogsLineWithProduct` creara una SEGUNDA
  // FpaDimension duplicada para el mismo producto en vez de reusar la
  // que ya se acababa de crear. `tx || prisma` es el mismo criterio
  // `tx = null` que ya usa el resto de este archivo.
  const variant = await (tx || prisma).productVariant.findFirst({
    where: { id: data.variantId, product: { companyId } },
    include: { product: { include: { category: true } }, bomAsParent: { where: { isActive: true }, include: { components: true } } },
  });
  if (!variant) {
    throw new AppError('La variante de producto indicada no existe.', 404, 'PRODUCT_VARIANT_NOT_FOUND');
  }
  await assertWarehouse(companyId, data.warehouseId);

  const qty = new Decimal(data.quantity);

  if (variant.bomAsParent && variant.bomAsParent.components.length > 0) {
    return createBomExit(companyId, userId, variant, data, qty, tx);
  }

  const method = await valuationService.resolveValuationMethod(companyId, variant.product);
  const cogsAccountId = await valuationService.resolveCogsExpenseAccount(companyId, variant.product);
  const inventoryAssetAccountId = await valuationService.resolveInventoryAssetAccount(companyId, variant.product);

  const { unitCost, totalCost, layerConsumptions } = await valuationService.computeExitCost(
    companyId,
    data.variantId,
    data.warehouseId,
    qty,
    method
  );

  return withTransaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: data.date,
        description: `Salida de inventario — ${variant.product.name} (${variant.sku})`,
        lines: [
          { accountId: cogsAccountId, debit: totalCost.toNumber(), credit: 0 },
          { accountId: inventoryAssetAccountId, debit: 0, credit: totalCost.toNumber() },
        ],
        origin: 'AUTOMATIC',
        sourceModule: 'inventory',
        sourceReference: data.referenceId || null,
        createdByUserId: userId,
        autoApprove: true,
      },
      tx
    );

    const movement = await tx.inventoryMovement.create({
      data: {
        companyId,
        variantId: data.variantId,
        warehouseId: data.warehouseId,
        type: data.type || 'SALE_EXIT',
        quantity: qty,
        unitCost,
        totalCost,
        date: data.date,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        journalEntryId: entry.id,
        notes: data.notes || null,
        createdByUserId: userId,
      },
    });

    await valuationService.applyExit(tx, {
      companyId,
      variantId: data.variantId,
      warehouseId: data.warehouseId,
      quantity: qty,
      method,
      layerConsumptions,
      movementId: movement.id,
    });

    await tagCogsLineWithProduct(tx, companyId, variant.product, entry.lines, cogsAccountId);

    await auditService.log(
      {
        companyId,
        userId,
        action: 'inventory_movement.exit_created',
        entityType: 'InventoryMovement',
        entityId: movement.id,
        oldValue: null,
        newValue: movement,
      },
      tx
    );

    return movement;
  }, tx);
}

async function createBomExit(companyId, userId, parentVariant, data, quantitySold, tx = null) {
  const componentPlan = explodeBomComponents(parentVariant.bomAsParent.components, quantitySold);

  const componentCosts = [];
  let totalCost = new Decimal(0);
  for (const component of componentPlan) {
    const componentVariant = await loadVariantWithProduct(companyId, component.componentVariantId);
    const method = await valuationService.resolveValuationMethod(companyId, componentVariant.product);
    const inventoryAssetAccountId = await valuationService.resolveInventoryAssetAccount(companyId, componentVariant.product);
    const { unitCost, totalCost: componentTotalCost, layerConsumptions } = await valuationService.computeExitCost(
      companyId,
      component.componentVariantId,
      data.warehouseId,
      component.quantityToConsume,
      method
    );
    componentCosts.push({
      componentVariant,
      quantity: component.quantityToConsume,
      unitCost,
      totalCost: componentTotalCost,
      inventoryAssetAccountId,
      method,
      layerConsumptions,
    });
    totalCost = totalCost.plus(componentTotalCost);
  }

  const cogsAccountId = await valuationService.resolveCogsExpenseAccount(companyId, parentVariant.product);

  const lines = [
    { accountId: cogsAccountId, debit: totalCost.toNumber(), credit: 0 },
    ...componentCosts.map((c) => ({ accountId: c.inventoryAssetAccountId, debit: 0, credit: c.totalCost.toNumber() })),
  ];

  return withTransaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: data.date,
        description: `Salida de inventario (kit) — ${parentVariant.product.name} (${parentVariant.sku})`,
        lines,
        origin: 'AUTOMATIC',
        sourceModule: 'inventory',
        sourceReference: data.referenceId || null,
        createdByUserId: userId,
        autoApprove: true,
      },
      tx
    );

    const parentMovement = await tx.inventoryMovement.create({
      data: {
        companyId,
        variantId: parentVariant.id,
        warehouseId: data.warehouseId,
        type: 'SALE_EXIT',
        quantity: quantitySold,
        unitCost: quantitySold.isZero() ? new Decimal(0) : totalCost.dividedBy(quantitySold),
        totalCost,
        date: data.date,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        journalEntryId: entry.id,
        notes: data.notes || null,
        createdByUserId: userId,
      },
    });

    for (const component of componentCosts) {
      const componentMovement = await tx.inventoryMovement.create({
        data: {
          companyId,
          variantId: component.componentVariant.id,
          warehouseId: data.warehouseId,
          type: 'CONSUMPTION_EXIT',
          quantity: component.quantity,
          unitCost: component.unitCost,
          totalCost: component.totalCost,
          date: data.date,
          referenceType: 'InventoryMovement',
          referenceId: parentMovement.id,
          journalEntryId: entry.id,
          createdByUserId: userId,
        },
      });

      await valuationService.applyExit(tx, {
        companyId,
        variantId: component.componentVariant.id,
        warehouseId: data.warehouseId,
        quantity: component.quantity,
        method: component.method,
        layerConsumptions: component.layerConsumptions,
        movementId: componentMovement.id,
      });

      await auditService.log(
        {
          companyId,
          userId,
          action: 'inventory_movement.bom_component_consumed',
          entityType: 'InventoryMovement',
          entityId: componentMovement.id,
          oldValue: null,
          newValue: componentMovement,
        },
        tx
      );
    }

    await tagCogsLineWithProduct(tx, companyId, parentVariant.product, entry.lines, cogsAccountId);

    await auditService.log(
      {
        companyId,
        userId,
        action: 'inventory_movement.bom_exit_created',
        entityType: 'InventoryMovement',
        entityId: parentMovement.id,
        oldValue: null,
        newValue: parentMovement,
      },
      tx
    );

    return parentMovement;
  }, tx);
}

// AJUSTE manual (punto 4): siempre exige motivo. El incremento se
// valora al costo indicado por quien ajusta (ej. se encontró stock
// extra); el decremento (merma) se valora con el motor de valoración,
// igual que una salida normal.
async function createAdjustment(companyId, userId, data) {
  const variant = await loadVariantWithProduct(companyId, data.variantId);
  await assertWarehouse(companyId, data.warehouseId);
  if (!data.reason) {
    throw new AppError('Todo ajuste de inventario necesita un motivo.', 400, 'ADJUSTMENT_REASON_REQUIRED');
  }

  const method = await valuationService.resolveValuationMethod(companyId, variant.product);
  const inventoryAssetAccountId = await valuationService.resolveInventoryAssetAccount(companyId, variant.product);
  const settings = await inventorySettingsService.getOrCreateSettings(companyId);
  if (!settings.defaultShrinkageExpenseAccountId) {
    throw new AppError(
      'No hay una cuenta de merma/ajuste configurada en Ajustes de Inventario.',
      400,
      'SHRINKAGE_ACCOUNT_NOT_CONFIGURED'
    );
  }

  const qty = new Decimal(data.quantity);
  const isIncrease = data.direction === 'INCREASE';

  let unitCost;
  let totalCost;
  let layerConsumptions = null;

  if (isIncrease) {
    unitCost = new Decimal(data.unitCost);
    totalCost = qty.times(unitCost).toDecimalPlaces(2);
  } else {
    const computed = await valuationService.computeExitCost(companyId, data.variantId, data.warehouseId, qty, method);
    unitCost = computed.unitCost;
    totalCost = computed.totalCost;
    layerConsumptions = computed.layerConsumptions;
  }

  const lines = isIncrease
    ? [
        { accountId: inventoryAssetAccountId, debit: totalCost.toNumber(), credit: 0 },
        { accountId: settings.defaultShrinkageExpenseAccountId, debit: 0, credit: totalCost.toNumber() },
      ]
    : [
        { accountId: settings.defaultShrinkageExpenseAccountId, debit: totalCost.toNumber(), credit: 0 },
        { accountId: inventoryAssetAccountId, debit: 0, credit: totalCost.toNumber() },
      ];

  return withTransaction(async (tx) => {
    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: data.date,
        description: `Ajuste de inventario (${isIncrease ? 'incremento' : 'merma'}) — ${variant.product.name} (${variant.sku}): ${data.reason}`,
        lines,
        origin: 'AUTOMATIC',
        sourceModule: 'inventory',
        sourceReference: data.referenceId || null,
        createdByUserId: userId,
        autoApprove: true,
      },
      tx
    );

    const movement = await tx.inventoryMovement.create({
      data: {
        companyId,
        variantId: data.variantId,
        warehouseId: data.warehouseId,
        type: isIncrease ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
        quantity: qty,
        unitCost,
        totalCost,
        date: data.date,
        journalEntryId: entry.id,
        notes: data.reason,
        createdByUserId: userId,
      },
    });

    if (isIncrease) {
      await valuationService.applyEntry(tx, {
        companyId,
        variantId: data.variantId,
        warehouseId: data.warehouseId,
        quantity: qty,
        unitCost,
        movementId: movement.id,
        date: data.date,
        method,
      });
    } else {
      await valuationService.applyExit(tx, {
        companyId,
        variantId: data.variantId,
        warehouseId: data.warehouseId,
        quantity: qty,
        method,
        layerConsumptions,
        movementId: movement.id,
      });
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'inventory_movement.adjustment_created',
        entityType: 'InventoryMovement',
        entityId: movement.id,
        oldValue: null,
        newValue: movement,
      },
      tx
    );

    return movement;
  });
}

async function listMovements(companyId, { variantId, warehouseId, type, from, to } = {}) {
  return prisma.inventoryMovement.findMany({
    where: {
      companyId,
      variantId: variantId || undefined,
      warehouseId: warehouseId || undefined,
      type: type || undefined,
      date: from || to ? { gte: from, lte: to } : undefined,
    },
    include: { variant: { include: { product: true } }, warehouse: true },
    orderBy: { date: 'desc' },
  });
}

module.exports = {
  createEntry,
  createExit,
  createAdjustment,
  listMovements,
  // F17-E16: AR necesita esta misma función para etiquetar la línea de
  // INGRESO de una factura (ver ar-invoices.service.js) — sin este
  // export, Rentabilidad por Producto nunca podía mostrar ingreso real
  // (solo costo), porque nada fuera de Inventario podía resolver/crear
  // la misma FpaDimension que ya usa tagCogsLineWithProduct.
  resolveProductFpaDimension,
};
