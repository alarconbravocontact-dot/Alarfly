// Fase 3 — pruebas de integración contra Postgres real de la extensión
// de ar-invoices.service para Ventas: factura directa de producto
// físico (sin pedido previo) dispara la salida real de inventario
// DENTRO de la misma transacción de la factura (punto 2/19/31), y
// facturar una línea ya entregada desde un Pedido usa el costo real
// que dejó la entrega, sin generar una segunda salida (punto 17/18).
const {
  prisma,
  cleanupCompany,
  buildSalesScenario,
} = require('../../../test-helpers/integration-fixtures');
const arInvoicesService = require('./ar-invoices.service');
const salesOrdersService = require('../../sales/services/sales-orders.service');
const salesDeliveriesService = require('../../sales/services/sales-deliveries.service');
const inventoryMovementsService = require('../../inventory/services/inventory-movements.service');

let scenario;

beforeEach(async () => {
  scenario = await buildSalesScenario();
});

afterEach(async () => {
  await cleanupCompany(scenario.company.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function invoiceData(overrides = {}) {
  const { customer, jurisdiction, incomeAccount } = scenario;
  return {
    customerId: customer.id,
    jurisdictionId: jurisdiction.id,
    incomeAccountId: incomeAccount.id,
    issueDate: new Date(),
    ...overrides,
  };
}

describe('Factura directa de producto físico (sin pedido) dispara la salida real', () => {
  test('la línea física queda con el costo real y el stock baja, todo en una sola transacción', async () => {
    const { company, user, variant, warehouse } = scenario;

    const invoice = await arInvoicesService.createInvoice(
      company.id,
      user.id,
      invoiceData({
        lines: [{ description: 'Venta directa', variantId: variant.id, warehouseId: warehouse.id, quantity: 6, unitPrice: 30 }],
      })
    );

    expect(Number(invoice.lines[0].unitCost)).toBe(10);

    const stock = await prisma.stockLevel.findFirst({ where: { variantId: variant.id, warehouseId: warehouse.id } });
    expect(Number(stock.quantityOnHand)).toBe(94); // 100 - 6

    const movement = await prisma.inventoryMovement.findFirst({ where: { referenceType: 'ArInvoice', referenceId: invoice.id } });
    expect(movement).not.toBeNull();
    expect(Number(movement.totalCost)).toBe(60);
  });

  test('una línea de SERVICIO en una factura directa nunca toca inventario', async () => {
    const { company, user, serviceVariant } = scenario;

    const invoice = await arInvoicesService.createInvoice(
      company.id,
      user.id,
      invoiceData({ lines: [{ description: 'Servicio', variantId: serviceVariant.id, quantity: 1, unitPrice: 80 }] })
    );

    expect(invoice.lines[0].unitCost).toBeNull();
    const movements = await prisma.inventoryMovement.findMany({ where: { referenceType: 'ArInvoice', referenceId: invoice.id } });
    expect(movements).toHaveLength(0);
  });

  test('línea física sin almacén se rechaza ANTES de tocar Fiscal/Ledger', async () => {
    const { company, user, variant } = scenario;
    await expect(
      arInvoicesService.createInvoice(
        company.id,
        user.id,
        invoiceData({ lines: [{ description: 'Sin almacén', variantId: variant.id, quantity: 1, unitPrice: 10 }] })
      )
    ).rejects.toThrow(/almacén/i);

    const fiscalTransactions = await prisma.fiscalTransaction.count({ where: { companyId: company.id } });
    expect(fiscalTransactions).toBe(0); // no se llegó ni a crear la transacción fiscal
  });

  // Atomicidad (punto 42), variante sobre la factura: si la salida de
  // inventario falla DESPUÉS de crear la factura, nada queda a medias
  // — ni la factura, ni el asiento fiscal, ni el movimiento.
  test('atomicidad: si la salida de inventario falla, la factura completa se revierte', async () => {
    const { company, user, variant, warehouse } = scenario;

    jest.spyOn(inventoryMovementsService, 'createExit').mockRejectedValueOnce(new Error('Fallo deliberado en la salida de inventario'));

    await expect(
      arInvoicesService.createInvoice(
        company.id,
        user.id,
        invoiceData({ lines: [{ description: 'Venta directa', variantId: variant.id, warehouseId: warehouse.id, quantity: 3, unitPrice: 30 }] })
      )
    ).rejects.toThrow('Fallo deliberado');

    inventoryMovementsService.createExit.mockRestore();

    const invoiceCount = await prisma.arInvoice.count({ where: { companyId: company.id } });
    expect(invoiceCount).toBe(0); // la factura NO quedó creada
    const fiscalCount = await prisma.fiscalTransaction.count({ where: { companyId: company.id } });
    expect(fiscalCount).toBe(0); // tampoco la transacción fiscal que la respaldaba

    const stock = await prisma.stockLevel.findFirst({ where: { variantId: variant.id, warehouseId: warehouse.id } });
    expect(Number(stock.quantityOnHand)).toBe(100); // el stock nunca se tocó
  });
});

describe('Facturar desde un Pedido ya entregado (punto 17-18): usa el costo real, sin duplicar la salida', () => {
  test('el costo de la línea es el promedio real entregado, y no se genera un segundo movimiento', async () => {
    const { company, user, customer, variant, warehouse } = scenario;

    const order = await salesOrdersService.createSalesOrder(company.id, user.id, {
      customerId: customer.id,
      orderDate: new Date(),
      lines: [{ description: 'Producto físico', variantId: variant.id, warehouseId: warehouse.id, quantity: 10, unitPrice: 30 }],
    });
    await salesOrdersService.confirmSalesOrder(company.id, user.id, order.id);
    const delivery = await salesDeliveriesService.createSalesDelivery(company.id, user.id, {
      orderId: order.id,
      deliveryDate: new Date(),
      lines: [{ orderLineId: order.lines[0].id, quantity: 10 }],
    });
    await salesDeliveriesService.confirmDelivery(company.id, user.id, delivery.id);

    const movementsBeforeInvoice = await prisma.inventoryMovement.count({ where: { companyId: company.id } });

    const invoice = await arInvoicesService.createInvoice(
      company.id,
      user.id,
      invoiceData({
        salesOrderId: order.id,
        lines: [{ description: 'Facturado desde pedido', variantId: variant.id, salesOrderLineId: order.lines[0].id, quantity: 10, unitPrice: 30 }],
      })
    );

    expect(Number(invoice.lines[0].unitCost)).toBe(10); // el costo real que dejó la entrega
    expect(invoice.salesOrderId).toBe(order.id);

    const movementsAfterInvoice = await prisma.inventoryMovement.count({ where: { companyId: company.id } });
    expect(movementsAfterInvoice).toBe(movementsBeforeInvoice); // NINGÚN movimiento nuevo

    const orderLine = await prisma.salesOrderLine.findUnique({ where: { id: order.lines[0].id } });
    expect(Number(orderLine.invoicedQuantity)).toBe(10);
  });

  test('rechaza facturar más de lo entregado y sin facturar de esa línea', async () => {
    const { company, user, customer, variant, warehouse } = scenario;
    const order = await salesOrdersService.createSalesOrder(company.id, user.id, {
      customerId: customer.id,
      orderDate: new Date(),
      lines: [{ description: 'Producto físico', variantId: variant.id, warehouseId: warehouse.id, quantity: 10, unitPrice: 30 }],
    });
    await salesOrdersService.confirmSalesOrder(company.id, user.id, order.id);
    const delivery = await salesDeliveriesService.createSalesDelivery(company.id, user.id, {
      orderId: order.id,
      deliveryDate: new Date(),
      lines: [{ orderLineId: order.lines[0].id, quantity: 4 }],
    });
    await salesDeliveriesService.confirmDelivery(company.id, user.id, delivery.id);

    await expect(
      arInvoicesService.createInvoice(
        company.id,
        user.id,
        invoiceData({
          salesOrderId: order.id,
          lines: [{ description: 'Excede lo entregado', variantId: variant.id, salesOrderLineId: order.lines[0].id, quantity: 5, unitPrice: 30 }],
        })
      )
    ).rejects.toThrow(/entregado y sin facturar/i);
  });
});
