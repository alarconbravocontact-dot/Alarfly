// F17-E20: Trazabilidad de Lotes (`GET /inventory/lots/:id/trace`) sumaba
// `StockCostLayer.remainingQuantity` para calcular cuánto queda de un lote.
// Un producto por Promedio Ponderado (PMP, el método por defecto de la
// empresa) NUNCA crea `StockCostLayer` — así que esa suma siempre daba 0,
// aunque el lote siguiera teniendo stock real. Mostrarle "0" a un usuario
// real para un lote que vence en días, cuando en realidad quedan unidades
// reales en el almacén, es un dato falso y peligroso (puede hacer tirar
// mercancía vigente por error). Se corrigió para que, cuando no existe
// ninguna capa de costo ligada al lote (PMP), el servicio reporte
// explícitamente que no puede saberlo (`exactTraceAvailable: false`,
// `remainingQuantity: null`) en vez de un "0" que parece una respuesta
// válida.
const {
  prisma,
  cleanupCompany,
  buildSalesScenario,
} = require('../../../test-helpers/integration-fixtures');
const inventoryMovementsService = require('./inventory-movements.service');
const lotTraceabilityService = require('./lot-traceability.service');

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

describe('Trazabilidad de un lote de un producto por Promedio Ponderado (PMP)', () => {
  test('reporta explícitamente que no puede saber la cantidad restante, en vez de un "0" falso', async () => {
    const { company, user, warehouse, uom, inventoryAssetAccount, cogsAccount } = scenario;

    // Producto nuevo con rastreo de lotes, SIN método de valoración propio
    // (hereda el de la empresa: Promedio Ponderado, el default real del
    // sistema — confirmado contra Postgres real en la empresa de prueba
    // F17 Empresa Nueva).
    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        sku: 'LOTE-PMP-TEST',
        name: 'Producto PMP con lote',
        baseUnitOfMeasureId: uom.id,
        inventoryAssetAccountId: inventoryAssetAccount.id,
        cogsExpenseAccountId: cogsAccount.id,
        trackLots: true,
        trackExpiration: true,
        variants: { create: [{ sku: 'LOTE-PMP-TEST-VAR' }] },
      },
      include: { variants: true },
    });
    const variant = product.variants[0];

    const entry = await inventoryMovementsService.createEntry(company.id, user.id, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 50,
      unitCost: 5,
      counterpartyAccountId: inventoryAssetAccount.id,
      date: new Date(),
      lotNumber: 'LOTE-PMP-A',
      expirationDate: new Date('2026-10-12'),
    });
    expect(entry.lotId).not.toBeNull();

    await inventoryMovementsService.createExit(company.id, user.id, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 15,
      date: new Date(),
      type: 'SALE_EXIT',
    });

    // El stock real sí bajó correctamente — esto NO es lo que falla.
    const stock = await prisma.stockLevel.findFirst({ where: { variantId: variant.id, warehouseId: warehouse.id } });
    expect(Number(stock.quantityOnHand)).toBe(35);

    // Lo que fallaba era específicamente el reporte de trazabilidad del lote.
    const trace = await lotTraceabilityService.getLotTrace(company.id, entry.lotId);
    expect(trace.exactTraceAvailable).toBe(false);
    expect(trace.remainingQuantity).toBeNull();
    expect(trace.entries).toHaveLength(1);
    expect(Number(trace.entries[0].quantity)).toBe(50);
  });
});

describe('Trazabilidad de un lote de un producto FIFO (con capas de costo reales)', () => {
  test('sigue reportando la cantidad restante exacta — el fix no afecta el caso que ya funcionaba', async () => {
    const { company, user, warehouse, uom, inventoryAssetAccount, cogsAccount } = scenario;

    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        sku: 'LOTE-FIFO-TEST',
        name: 'Producto FIFO con lote',
        baseUnitOfMeasureId: uom.id,
        inventoryAssetAccountId: inventoryAssetAccount.id,
        cogsExpenseAccountId: cogsAccount.id,
        valuationMethod: 'FIFO',
        trackLots: true,
        variants: { create: [{ sku: 'LOTE-FIFO-TEST-VAR' }] },
      },
      include: { variants: true },
    });
    const variant = product.variants[0];

    const entry = await inventoryMovementsService.createEntry(company.id, user.id, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 50,
      unitCost: 5,
      counterpartyAccountId: inventoryAssetAccount.id,
      date: new Date(),
      lotNumber: 'LOTE-FIFO-A',
    });

    await inventoryMovementsService.createExit(company.id, user.id, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 15,
      date: new Date(),
      type: 'SALE_EXIT',
    });

    const trace = await lotTraceabilityService.getLotTrace(company.id, entry.lotId);
    expect(trace.exactTraceAvailable).toBe(true);
    expect(trace.remainingQuantity).toBe('35.0000');
    expect(trace.usages).toHaveLength(1);
    expect(Number(trace.usages[0].quantityConsumed)).toBe(15);
  });
});
