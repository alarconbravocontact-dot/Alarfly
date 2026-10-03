// F17-E20: `scanExpiringLots` sumaba `StockCostLayer.remainingQuantity`
// para decidir si un lote todavía tenía stock y merecía una alerta de
// vencimiento. Un producto por Promedio Ponderado (PMP, el método por
// defecto de la empresa) nunca crea esas capas, así que la suma
// siempre daba 0 y el lote se saltaba SIEMPRE — la alerta
// PRODUCT_EXPIRING_SOON nunca se disparaba para el caso más común,
// sin importar cuán cerca estuviera de vencer ni cuánto stock real
// quedara. Se corrigió para que, sin capas de costo, se use el stock
// actual del producto como señal conservadora de "podría quedar algo
// de este lote" en vez de asumir 0 silenciosamente.
const {
  prisma,
  cleanupCompany,
  buildSalesScenario,
} = require('../../../test-helpers/integration-fixtures');
const inventoryMovementsService = require('./inventory-movements.service');
const inventoryAlertsService = require('./inventory-alerts.service');

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

async function createLotTrackedProduct(scenario, overrides = {}) {
  const { company, uom, inventoryAssetAccount, cogsAccount } = scenario;
  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      sku: overrides.sku || 'LOTE-ALERT-TEST',
      name: overrides.name || 'Producto con lote y vencimiento',
      baseUnitOfMeasureId: uom.id,
      inventoryAssetAccountId: inventoryAssetAccount.id,
      cogsExpenseAccountId: cogsAccount.id,
      trackLots: true,
      trackExpiration: true,
      valuationMethod: overrides.valuationMethod || null,
      variants: { create: [{ sku: `${overrides.sku || 'LOTE-ALERT-TEST'}-VAR` }] },
    },
    include: { variants: true },
  });
  return { product, variant: product.variants[0] };
}

describe('Alerta de vencimiento de lote (PRODUCT_EXPIRING_SOON) — producto por Promedio Ponderado', () => {
  test('se dispara igual, aunque no exista una capa de costo ligada al lote', async () => {
    const { company, user, warehouse, inventoryAssetAccount } = scenario;
    const { variant } = await createLotTrackedProduct(scenario, { sku: 'LOTE-PMP-ALERT' });

    const soon = new Date();
    soon.setDate(soon.getDate() + 5); // vence en 5 días, bien dentro de cualquier umbral razonable

    await inventoryMovementsService.createEntry(company.id, user.id, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 30,
      unitCost: 5,
      counterpartyAccountId: inventoryAssetAccount.id,
      date: new Date(),
      lotNumber: 'LOTE-PMP-ALERT-A',
      expirationDate: soon,
    });

    await prisma.alertRule.create({
      data: { companyId: company.id, type: 'PRODUCT_EXPIRING_SOON', name: 'Vencimiento prueba', parameters: { daysBefore: 15 } },
    });

    const alerts = await inventoryAlertsService.scanExpiringLots(company.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('PRODUCT_EXPIRING_SOON');
    expect(alerts[0].message).toMatch(/Promedio Ponderado/);
    expect(alerts[0].message).toMatch(/30\.0000/);
  });

  test('NO se dispara si el producto ya no tiene stock real (evita falsos positivos)', async () => {
    const { company, user, warehouse, inventoryAssetAccount } = scenario;
    const { variant } = await createLotTrackedProduct(scenario, { sku: 'LOTE-PMP-AGOTADO' });

    const soon = new Date();
    soon.setDate(soon.getDate() + 5);

    await inventoryMovementsService.createEntry(company.id, user.id, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 10,
      unitCost: 5,
      counterpartyAccountId: inventoryAssetAccount.id,
      date: new Date(),
      lotNumber: 'LOTE-PMP-AGOTADO-A',
      expirationDate: soon,
    });
    await inventoryMovementsService.createExit(company.id, user.id, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 10,
      date: new Date(),
      type: 'SALE_EXIT',
    });

    await prisma.alertRule.create({
      data: { companyId: company.id, type: 'PRODUCT_EXPIRING_SOON', name: 'Vencimiento prueba', parameters: { daysBefore: 15 } },
    });

    const alerts = await inventoryAlertsService.scanExpiringLots(company.id);
    expect(alerts).toHaveLength(0);
  });
});

describe('Alerta de vencimiento de lote (PRODUCT_EXPIRING_SOON) — producto FIFO (con capas reales)', () => {
  test('sigue funcionando exacto — el fix no afecta el caso que ya era correcto', async () => {
    const { company, user, warehouse, inventoryAssetAccount } = scenario;
    const { variant } = await createLotTrackedProduct(scenario, { sku: 'LOTE-FIFO-ALERT', valuationMethod: 'FIFO' });

    const soon = new Date();
    soon.setDate(soon.getDate() + 5);

    await inventoryMovementsService.createEntry(company.id, user.id, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 40,
      unitCost: 5,
      counterpartyAccountId: inventoryAssetAccount.id,
      date: new Date(),
      lotNumber: 'LOTE-FIFO-ALERT-A',
      expirationDate: soon,
    });
    await inventoryMovementsService.createExit(company.id, user.id, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 10,
      date: new Date(),
      type: 'SALE_EXIT',
    });

    await prisma.alertRule.create({
      data: { companyId: company.id, type: 'PRODUCT_EXPIRING_SOON', name: 'Vencimiento prueba', parameters: { daysBefore: 15 } },
    });

    const alerts = await inventoryAlertsService.scanExpiringLots(company.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).not.toMatch(/Promedio Ponderado/);
    expect(alerts[0].message).toMatch(/30\.0000/); // 40 - 10, exacto vía capas FIFO
  });
});
