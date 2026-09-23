// Fase 4 — pruebas de integración contra Postgres real (sin mocks) del
// ciclo completo de Compras: Orden de Compra → Recepción → Inventario →
// Factura de Compra → CxP → Pago → Nota de Crédito/Débito a proveedor.
// Cubren los escenarios explícitamente pedidos: atomicidad de la
// recepción (con rollback forzado), costo real recibido vs. costo
// estimado, no duplicar el movimiento de inventario al facturar contra
// una línea ya recibida, sobre-recepción permitida y reportada (nunca
// bloqueada), producto físico vs. servicio, snapshot BCV en el pago,
// AP sin anticipos (aplicación exacta obligatoria), aislamiento por
// empresa, y devolución física real a proveedor vía nota de crédito.
const {
  prisma,
  buildPurchaseScenario,
  cleanupCompany,
  createAccount,
  createTreasuryAccount,
} = require('../../../test-helpers/integration-fixtures');
const purchaseOrdersService = require('../../inventory/services/purchase-orders.service');
const apBillsService = require('./ap-bills.service');
const apPaymentsService = require('./ap-payments.service');
const apCreditNotesService = require('./ap-credit-notes.service');
const fxService = require('../../../core/fx/fx.service');

let scenario;

beforeEach(async () => {
  scenario = await buildPurchaseScenario();
});

afterEach(async () => {
  await cleanupCompany(scenario.company.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function stockOf(variantId, warehouseId) {
  return prisma.stockLevel.findFirst({ where: { variantId, warehouseId } });
}

async function createReceivedPO(quantity = 30, unitCost = 10) {
  const { company, user, vendor, warehouse, variant, payableGlAccount } = scenario;
  const po = await purchaseOrdersService.createPurchaseOrder(company.id, user.id, {
    vendorId: vendor.id,
    warehouseId: warehouse.id,
    orderDate: new Date(),
    lines: [{ variantId: variant.id, quantityOrdered: quantity }],
  });
  await purchaseOrdersService.submitPurchaseOrder(company.id, user.id, po.id);
  const received = await purchaseOrdersService.receivePurchaseOrder(company.id, user.id, po.id, {
    date: new Date(),
    counterpartyAccountId: payableGlAccount.id,
    receipts: [{ lineId: po.lines[0].id, quantityReceived: quantity, unitCost }],
  });
  return received.order;
}

describe('Recepción de orden de compra: costo real y atomicidad', () => {
  test('dos recepciones parciales acumulan quantityReceived/receivedCostTotal reales y actualizan el estado', async () => {
    const { company, user, vendor, warehouse, variant, payableGlAccount } = scenario;
    const po = await purchaseOrdersService.createPurchaseOrder(company.id, user.id, {
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      orderDate: new Date(),
      lines: [{ variantId: variant.id, quantityOrdered: 100 }],
    });
    await purchaseOrdersService.submitPurchaseOrder(company.id, user.id, po.id);

    const r1 = await purchaseOrdersService.receivePurchaseOrder(company.id, user.id, po.id, {
      date: new Date(),
      counterpartyAccountId: payableGlAccount.id,
      receipts: [{ lineId: po.lines[0].id, quantityReceived: 60, unitCost: 10 }],
    });
    expect(r1.order.status).toBe('PARTIALLY_RECEIVED');
    expect(Number(r1.order.lines[0].quantityReceived)).toBe(60);
    expect(Number(r1.order.lines[0].receivedCostTotal)).toBe(600);

    const r2 = await purchaseOrdersService.receivePurchaseOrder(company.id, user.id, po.id, {
      date: new Date(),
      counterpartyAccountId: payableGlAccount.id,
      receipts: [{ lineId: po.lines[0].id, quantityReceived: 40, unitCost: 12 }],
    });
    expect(r2.order.status).toBe('RECEIVED');
    expect(Number(r2.order.lines[0].quantityReceived)).toBe(100);
    expect(Number(r2.order.lines[0].receivedCostTotal)).toBe(1080); // 600 + 40*12

    const stock = await stockOf(variant.id, warehouse.id);
    expect(Number(stock.quantityOnHand)).toBe(100);

    const movements = await prisma.inventoryMovement.findMany({ where: { purchaseOrderLineId: po.lines[0].id } });
    expect(movements).toHaveLength(2); // trazabilidad: un movimiento real por cada recepción
  });

  // Prueba explícita de atomicidad: forzar un fallo DESPUÉS de que la
  // primera línea ya generó su entrada real de inventario dentro de la
  // MISMA transacción de receivePurchaseOrder, y verificar que TODO se
  // revierte — ni el movimiento, ni quantityReceived, ni el estado de
  // la orden quedan a medias.
  test('atomicidad: un fallo a mitad de la recepción revierte todo (ni inventario ni la orden quedan a medias)', async () => {
    const { company, user, vendor, warehouse, variant, payableGlAccount } = scenario;
    const po = await purchaseOrdersService.createPurchaseOrder(company.id, user.id, {
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      orderDate: new Date(),
      lines: [
        { variantId: variant.id, quantityOrdered: 10 },
        { variantId: variant.id, quantityOrdered: 10 },
      ],
    });
    await purchaseOrdersService.submitPurchaseOrder(company.id, user.id, po.id);

    const inventoryMovementsService = require('../../inventory/services/inventory-movements.service');
    const realCreateEntry = inventoryMovementsService.createEntry;
    let calls = 0;
    jest.spyOn(inventoryMovementsService, 'createEntry').mockImplementation(async (...args) => {
      calls += 1;
      const movement = await realCreateEntry(...args);
      if (calls === 2) {
        throw new Error('Fallo deliberado DESPUÉS de la segunda entrada real, para probar el rollback');
      }
      return movement;
    });

    await expect(
      purchaseOrdersService.receivePurchaseOrder(company.id, user.id, po.id, {
        date: new Date(),
        counterpartyAccountId: payableGlAccount.id,
        receipts: [
          { lineId: po.lines[0].id, quantityReceived: 5, unitCost: 10 },
          { lineId: po.lines[1].id, quantityReceived: 5, unitCost: 10 },
        ],
      })
    ).rejects.toThrow('Fallo deliberado');

    inventoryMovementsService.createEntry.mockRestore();

    const stock = await stockOf(variant.id, warehouse.id);
    expect(stock == null || Number(stock.quantityOnHand) === 0).toBe(true); // ningún movimiento quedó confirmado

    const movements = await prisma.inventoryMovement.findMany({ where: { referenceId: po.id } });
    expect(movements).toHaveLength(0);

    const refreshedPO = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include: { lines: true } });
    expect(refreshedPO.status).toBe('SUBMITTED'); // no quedó PARTIALLY_RECEIVED a medias
    expect(Number(refreshedPO.lines[0].quantityReceived)).toBe(0);
    expect(Number(refreshedPO.lines[1].quantityReceived)).toBe(0);
  });

  test('sobre-recepción: se permite, se reporta como discrepancia, y NO bloquea la recepción', async () => {
    const { company, user, vendor, warehouse, variant, payableGlAccount } = scenario;
    const po = await purchaseOrdersService.createPurchaseOrder(company.id, user.id, {
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      orderDate: new Date(),
      lines: [{ variantId: variant.id, quantityOrdered: 10 }],
    });
    await purchaseOrdersService.submitPurchaseOrder(company.id, user.id, po.id);

    const received = await purchaseOrdersService.receivePurchaseOrder(company.id, user.id, po.id, {
      date: new Date(),
      counterpartyAccountId: payableGlAccount.id,
      receipts: [{ lineId: po.lines[0].id, quantityReceived: 15, unitCost: 10 }],
    });

    expect(received.discrepancies[0].hasDiscrepancy).toBe(true);
    expect(received.discrepancies[0].discrepancy).toBe('5.0000');
    expect(received.order.status).toBe('RECEIVED');
    expect(Number(received.order.lines[0].quantityReceived)).toBe(15);
  });
});

describe('Factura de compra contra línea ya recibida: costo real, sin duplicar el movimiento', () => {
  test('usa el costo real promedio recibido (averageReceivedUnitCost), nunca genera un segundo movimiento', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount } = scenario;

    // Recepción parcial adicional para tener un costo promedio real que probar.
    const po2 = await purchaseOrdersService.createPurchaseOrder(company.id, user.id, {
      vendorId: vendor.id,
      warehouseId: scenario.warehouse.id,
      orderDate: new Date(),
      lines: [{ variantId: scenario.variant.id, quantityOrdered: 20 }],
    });
    await purchaseOrdersService.submitPurchaseOrder(company.id, user.id, po2.id);
    const receivedAgain = await purchaseOrdersService.receivePurchaseOrder(company.id, user.id, po2.id, {
      date: new Date(),
      counterpartyAccountId: scenario.payableGlAccount.id,
      receipts: [{ lineId: po2.lines[0].id, quantityReceived: 20, unitCost: 16 }],
    });
    // averageReceivedUnitCost = 320/20 = 16
    const movementsBefore = await prisma.inventoryMovement.count({ where: { companyId: company.id } });

    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Compra recibida', quantity: 20, unitPrice: 16, variantId: scenario.variant.id, purchaseOrderLineId: receivedAgain.order.lines[0].id }],
    });

    const movementsAfter = await prisma.inventoryMovement.count({ where: { companyId: company.id } });
    expect(movementsAfter).toBe(movementsBefore); // no se generó ningún movimiento nuevo

    expect(Number(bill.lines[0].unitCost)).toBe(16);
    const poLine = await prisma.purchaseOrderLine.findUnique({ where: { id: receivedAgain.order.lines[0].id } });
    expect(Number(poLine.billedQuantity)).toBe(20);
  });

  test('rechaza facturar más de lo recibido-y-sin-facturar todavía', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount, variant } = scenario;
    const order = await createReceivedPO(10, 10);

    await expect(
      apBillsService.createBill(company.id, user.id, {
        vendorId: vendor.id,
        jurisdictionId: jurisdiction.id,
        expenseAccountId: expenseAccount.id,
        issueDate: new Date(),
        lines: [{ description: 'Exceso', quantity: 15, unitPrice: 10, variantId: variant.id, purchaseOrderLineId: order.lines[0].id }],
      })
    ).rejects.toThrow(/recibido y sin facturar/i);
  });

  test('duplicación: facturar dos veces la misma línea recibida (parcial + resto) nunca supera lo recibido', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount, variant } = scenario;
    const order = await createReceivedPO(10, 10);

    await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Parte 1', quantity: 6, unitPrice: 10, variantId: variant.id, purchaseOrderLineId: order.lines[0].id }],
    });
    await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Parte 2 (el resto exacto)', quantity: 4, unitPrice: 10, variantId: variant.id, purchaseOrderLineId: order.lines[0].id }],
    });

    const poLine = await prisma.purchaseOrderLine.findUnique({ where: { id: order.lines[0].id } });
    expect(Number(poLine.billedQuantity)).toBe(10);

    // Un tercer intento, aunque sea de 1 unidad, ya no tiene saldo.
    await expect(
      apBillsService.createBill(company.id, user.id, {
        vendorId: vendor.id,
        jurisdictionId: jurisdiction.id,
        expenseAccountId: expenseAccount.id,
        issueDate: new Date(),
        lines: [{ description: 'Ya no queda nada', quantity: 1, unitPrice: 10, variantId: variant.id, purchaseOrderLineId: order.lines[0].id }],
      })
    ).rejects.toThrow(/recibido y sin facturar/i);
  });
});

describe('Factura de compra directa (sin orden): entrada real de inventario, ledger correcto', () => {
  test('producto físico sin purchaseOrderLineId genera una entrada real y el neteo contable es débito Inventario / crédito Cuentas por Pagar', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount, inventoryAssetAccount, payableGlAccount, warehouse, variant } = scenario;

    const stockBefore = await stockOf(variant.id, warehouse.id);
    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Compra directa', quantity: 20, unitPrice: 15, variantId: variant.id, warehouseId: warehouse.id }],
    });

    const stockAfter = await stockOf(variant.id, warehouse.id);
    expect(Number(stockAfter.quantityOnHand)).toBe((stockBefore ? Number(stockBefore.quantityOnHand) : 0) + 20);
    expect(Number(bill.lines[0].unitCost)).toBe(15);

    const movement = await prisma.inventoryMovement.findFirst({ where: { companyId: company.id, referenceType: 'ApBill', referenceId: bill.id } });
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('PURCHASE_ENTRY');

    const fiscalTransaction = await prisma.fiscalTransaction.findUnique({ where: { id: bill.fiscalTransactionId } });
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: { in: [fiscalTransaction.journalEntryId, movement.journalEntryId] } },
    });
    const netByAccount = new Map();
    for (const l of lines) {
      const cur = netByAccount.get(l.accountId) || { debit: 0, credit: 0 };
      cur.debit += Number(l.debit);
      cur.credit += Number(l.credit);
      netByAccount.set(l.accountId, cur);
    }
    const expenseNet = netByAccount.get(expenseAccount.id);
    const inventoryNet = netByAccount.get(inventoryAssetAccount.id);
    const payableNet = netByAccount.get(payableGlAccount.id);

    expect(expenseNet.debit - expenseNet.credit).toBeCloseTo(0, 5); // la cuenta de gasto se usa de pasarela y neta a 0
    expect(inventoryNet.debit - inventoryNet.credit).toBeCloseTo(300, 2); // 20*15
    expect(payableNet.credit - payableNet.debit).toBeCloseTo(300, 2);
  });
});

describe('Factura de compra de un servicio: nunca toca inventario', () => {
  test('línea de servicio no genera movimiento ni costo, ni pide almacén', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount, serviceVariant } = scenario;
    const movementsBefore = await prisma.inventoryMovement.count({ where: { companyId: company.id } });

    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio de mantenimiento', quantity: 1, unitPrice: 200, variantId: serviceVariant.id }],
    });

    const movementsAfter = await prisma.inventoryMovement.count({ where: { companyId: company.id } });
    expect(movementsAfter).toBe(movementsBefore);
    expect(bill.lines[0].unitCost).toBeNull();
    expect(bill.lines[0].warehouseId).toBeNull();
  });
});

describe('Pago a proveedor: snapshot histórico BCV + método de pago', () => {
  test('con foreignCurrency+foreignAmount, el monto base se deriva de la tasa vigente y queda como snapshot histórico', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount } = scenario;
    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 100, variantId: scenario.serviceVariant.id }],
    });

    // Convención del proyecto: ExchangeRate.rate = unidades de moneda
    // BASE por 1 unidad de la moneda extranjera. Con 1 USD = 40 Bs
    // reales, 1 Bs = 1/40 USD.
    const rate = 1 / 40;
    await fxService.recordRate({ companyId: company.id, currency: 'VES', rate, date: new Date() });
    const paymentMethod = await prisma.paymentMethod.create({ data: { companyId: company.id, code: 'ZELLE', name: 'Zelle' } });
    const treasuryGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
    const treasuryAccount = await createTreasuryAccount(company.id, treasuryGlAccount.id, 100000);

    const totalOwed = Number(bill.totalAmount);
    const payment = await apPaymentsService.recordPayment(company.id, user.id, {
      vendorId: vendor.id,
      treasuryAccountId: treasuryAccount.id,
      date: new Date(),
      paymentMethodId: paymentMethod.id,
      foreignCurrency: 'VES',
      foreignAmount: totalOwed * 40,
      applications: [{ billId: bill.id, amount: totalOwed }],
    });

    expect(payment.paymentMethodId).toBe(paymentMethod.id);
    expect(Number(payment.exchangeRate)).toBeCloseTo(rate, 9);
    expect(Number(payment.amount)).toBeCloseTo(totalOwed, 2);

    const billAfter = await apBillsService.getBill(company.id, bill.id);
    expect(billAfter.status).toBe('PAID');
  });
});

describe('AP no admite anticipos: la suma aplicada debe ser exacta', () => {
  test('rechaza un pago cuya suma aplicada no coincide con el monto', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount, serviceVariant } = scenario;
    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 100, variantId: serviceVariant.id }],
    });
    const treasuryGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
    const treasuryAccount = await createTreasuryAccount(company.id, treasuryGlAccount.id, 100000);

    await expect(
      apPaymentsService.recordPayment(company.id, user.id, {
        vendorId: vendor.id,
        treasuryAccountId: treasuryAccount.id,
        date: new Date(),
        amount: 999,
        applications: [{ billId: bill.id, amount: 1 }],
      })
    ).rejects.toThrow(/igual al monto/i);
  });
});

describe('Aislamiento por empresa (Compras)', () => {
  test('una factura o una orden de compra de otra empresa es invisible', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount, serviceVariant } = scenario;
    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 100, variantId: serviceVariant.id }],
    });
    const po = await createReceivedPO(5, 10);

    const other = await buildPurchaseScenario();
    try {
      await expect(apBillsService.getBill(other.company.id, bill.id)).rejects.toThrow(/no existe/i);
      await expect(purchaseOrdersService.getPurchaseOrder(other.company.id, po.id)).rejects.toThrow(/no existe/i);
    } finally {
      await cleanupCompany(other.company.id);
    }
  });
});

describe('Devolución física a proveedor (nota de crédito con movimiento real de inventario)', () => {
  test('con physicalReturn, genera un VENDOR_RETURN_EXIT real, lo liga a la nota, y ajusta el total de la factura', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount, warehouse, variant } = scenario;
    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Compra directa', quantity: 20, unitPrice: 15, variantId: variant.id, warehouseId: warehouse.id }],
    });
    const stockBefore = await stockOf(variant.id, warehouse.id);

    const note = await apCreditNotesService.createCreditNote(company.id, user.id, {
      billId: bill.id,
      type: 'CREDIT',
      reason: 'Devolución de 5 unidades defectuosas',
      amount: 75,
      date: new Date(),
      physicalReturn: { productVariantId: variant.id, warehouseId: warehouse.id, quantity: 5 },
    });

    const stockAfter = await stockOf(variant.id, warehouse.id);
    expect(Number(stockBefore.quantityOnHand) - Number(stockAfter.quantityOnHand)).toBe(5);
    expect(note.relatedInventoryMovementId).not.toBeNull();

    const movement = await prisma.inventoryMovement.findUnique({ where: { id: note.relatedInventoryMovementId } });
    expect(movement.type).toBe('VENDOR_RETURN_EXIT');

    const billAfter = await apBillsService.getBill(company.id, bill.id);
    expect(Number(billAfter.totalAmount)).toBeCloseTo(Number(bill.totalAmount) - 75, 2);
  });

  test('sin physicalReturn, la nota es puramente financiera y no toca inventario', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount, serviceVariant } = scenario;
    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 200, variantId: serviceVariant.id }],
    });
    const movementsBefore = await prisma.inventoryMovement.count({ where: { companyId: company.id } });

    const note = await apCreditNotesService.createCreditNote(company.id, user.id, {
      billId: bill.id,
      type: 'DEBIT',
      reason: 'Cargo adicional por flete',
      amount: 10,
      date: new Date(),
    });

    expect(note.relatedInventoryMovementId).toBeNull();
    const movementsAfter = await prisma.inventoryMovement.count({ where: { companyId: company.id } });
    expect(movementsAfter).toBe(movementsBefore);
  });

  test('la numeración de notas se incrementa de forma atómica, sin colisión', async () => {
    const { company, user, vendor, jurisdiction, expenseAccount, serviceVariant } = scenario;
    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 200, variantId: serviceVariant.id }],
    });

    const note1 = await apCreditNotesService.createCreditNote(company.id, user.id, {
      billId: bill.id,
      type: 'DEBIT',
      reason: 'Ajuste 1',
      amount: 5,
      date: new Date(),
    });
    const note2 = await apCreditNotesService.createCreditNote(company.id, user.id, {
      billId: bill.id,
      type: 'DEBIT',
      reason: 'Ajuste 2',
      amount: 5,
      date: new Date(),
    });

    expect(note2.noteNumber).toBe(note1.noteNumber + 1);
  });
});
