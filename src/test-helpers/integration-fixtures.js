// Fixtures mínimos y reales (contra Postgres, sin mocks) para las
// pruebas de integración de Fase 1 (Unit of Work / Ledger / Tesorería).
// Cada helper crea solo lo estrictamente necesario para que el flujo de
// negocio real bajo prueba pueda correr de punta a punta.
require('../core/config');
const prisma = require('../core/database/prisma');

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function createCompany() {
  return prisma.company.create({ data: { name: unique('Empresa de prueba') } });
}

async function createUser(companyId, role = 'ADMIN') {
  return prisma.user.create({
    data: {
      companyId,
      name: 'Usuario de prueba',
      email: `${unique('user')}@example.com`,
      role,
      status: 'ACTIVE',
      isActive: true,
    },
  });
}

async function createAccount(companyId, { type, normalBalance, code }) {
  return prisma.account.create({
    data: {
      companyId,
      code: code || unique('CTA'),
      name: unique(`Cuenta ${type}`),
      type,
      normalBalance,
      isPostable: true,
      isActive: true,
    },
  });
}

// Periodo contable ABIERTO que cubre "hoy" — todo lo que postea el
// Ledger en las pruebas cae dentro de este rango.
async function createOpenPeriod(companyId) {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59));
  return prisma.accountingPeriod.create({
    data: { companyId, name: `Año ${now.getUTCFullYear()}`, startDate, endDate, status: 'OPEN' },
  });
}

async function createTreasuryAccount(companyId, glAccountId, currentBalance = 0) {
  return prisma.treasuryAccount.create({
    data: {
      companyId,
      type: 'BANK_ACCOUNT',
      name: unique('Banco de prueba'),
      currency: 'USD',
      glAccountId,
      currentBalance,
    },
  });
}

async function createTaxJurisdiction(companyId) {
  return prisma.taxJurisdiction.create({
    data: { companyId, code: unique('JX'), name: 'Jurisdicción de prueba' },
  });
}

async function createCustomer(companyId) {
  return prisma.customer.create({ data: { companyId, name: unique('Cliente de prueba') } });
}

async function setReceivableAccount(companyId, receivableGlAccountId) {
  return prisma.arApSettings.upsert({
    where: { companyId },
    create: { companyId, receivableGlAccountId },
    update: { receivableGlAccountId },
  });
}

// Fase 3 (Ventas): fixtures del lado de Inventario/Productos que las
// pruebas de Ventas necesitan para armar un escenario real completo.
async function createUnitOfMeasure(companyId) {
  return prisma.unitOfMeasure.create({ data: { companyId, code: unique('UN'), name: 'Unidad de prueba' } });
}

async function createWarehouse(companyId) {
  return prisma.warehouse.create({ data: { companyId, code: unique('ALM'), name: 'Almacén de prueba' } });
}

// Producto físico con costo/inventario listos para vender: crea su
// propia variante por defecto (mismo criterio que products.service —
// "todo producto siempre tiene variante"), cuentas de inventario/COGS
// postables, y una entrada real de stock (vía el motor de valoración
// real, nunca insertando StockLevel a mano) para que haya algo que
// vender/reservar/entregar.
async function createPhysicalProduct(companyId, userId, { uom, assetAccount, cogsAccount, warehouse, initialQuantity = 100, unitCost = 10 }) {
  const inventoryMovementsService = require('../modules/inventory/services/inventory-movements.service');
  const product = await prisma.product.create({
    data: {
      companyId,
      sku: unique('SKU'),
      name: 'Producto físico de prueba',
      baseUnitOfMeasureId: uom.id,
      inventoryAssetAccountId: assetAccount.id,
      cogsExpenseAccountId: cogsAccount.id,
      isService: false,
      variants: { create: [{ sku: unique('VAR') }] },
    },
    include: { variants: true },
  });
  const variant = product.variants[0];
  if (initialQuantity > 0) {
    await inventoryMovementsService.createEntry(companyId, userId, {
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: initialQuantity,
      unitCost,
      date: new Date(),
      counterpartyAccountId: assetAccount.id, // contrapartida cualquiera postable, solo para la prueba
    });
  }
  return { product, variant };
}

async function createServiceProduct(companyId, uom) {
  const product = await prisma.product.create({
    data: {
      companyId,
      sku: unique('SRV'),
      name: 'Servicio de prueba',
      baseUnitOfMeasureId: uom.id,
      isService: true,
      variants: { create: [{ sku: unique('SRVVAR') }] },
    },
    include: { variants: true },
  });
  return { product, variant: product.variants[0] };
}

// Arma un escenario completo de Ventas (Fase 3): además de todo lo de
// `buildTreasuryScenario`, un producto físico con 100 unidades reales
// en stock (costo 10), un producto servicio, y las cuentas fiscales
// mínimas para poder facturar.
async function buildSalesScenario() {
  const base = await buildTreasuryScenario();
  const uom = await createUnitOfMeasure(base.company.id);
  const warehouse = await createWarehouse(base.company.id);
  const inventoryAssetAccount = await createAccount(base.company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  const cogsAccount = await createAccount(base.company.id, { type: 'EXPENSE', normalBalance: 'DEBIT' });
  const incomeAccount = await createAccount(base.company.id, { type: 'INCOME', normalBalance: 'CREDIT' });
  const jurisdiction = await createTaxJurisdiction(base.company.id);
  const { product, variant } = await createPhysicalProduct(base.company.id, base.user.id, {
    uom,
    assetAccount: inventoryAssetAccount,
    cogsAccount,
    warehouse,
  });
  const service = await createServiceProduct(base.company.id, uom);

  return { ...base, uom, warehouse, inventoryAssetAccount, cogsAccount, incomeAccount, jurisdiction, product, variant, serviceProduct: service.product, serviceVariant: service.variant };
}

// Arma un escenario completo listo para registrar un cobro real de AR:
// empresa, usuario, cuenta bancaria + su GL, cuenta de CxC, periodo
// abierto y cliente. Es el fixture que usan las pruebas de doble
// contabilización (Fase 1, Tesorería).
async function buildTreasuryScenario() {
  const company = await createCompany();
  const user = await createUser(company.id);
  const bankGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  const receivableGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  const treasuryAccount = await createTreasuryAccount(company.id, bankGlAccount.id, 0);
  await createOpenPeriod(company.id);
  await setReceivableAccount(company.id, receivableGlAccount.id);
  const customer = await createCustomer(company.id);

  return { company, user, bankGlAccount, receivableGlAccount, treasuryAccount, customer };
}

// Limpia todo lo creado por una empresa de prueba, en el orden correcto
// para respetar las FKs (cascada explícita, sin depender de onDelete en
// modelos que no la tienen).
async function cleanupCompany(companyId) {
  await prisma.reconciliationMatch.deleteMany({ where: { reconciliation: { companyId } } });
  await prisma.bankReconciliation.deleteMany({ where: { companyId } });
  await prisma.bankTransaction.deleteMany({ where: { companyId } });
  await prisma.statementImport.deleteMany({ where: { companyId } });
  await prisma.arPaymentApplication.deleteMany({ where: { payment: { companyId } } });
  await prisma.arPayment.deleteMany({ where: { companyId } });
  await prisma.arCreditNote.deleteMany({ where: { companyId } });

  // Fase 3 (Ventas): hijos antes que padres — entregas/reservas antes
  // que sus líneas de pedido, líneas de factura antes que la factura,
  // y todo el lado de Ventas antes de tocar Inventario/Ledger, que es
  // de quien depende.
  await prisma.salesDeliveryLine.deleteMany({ where: { delivery: { companyId } } });
  await prisma.salesDelivery.deleteMany({ where: { companyId } });
  await prisma.inventoryReservation.deleteMany({ where: { companyId } });
  await prisma.arInvoiceLine.deleteMany({ where: { invoice: { companyId } } });
  await prisma.arInvoice.deleteMany({ where: { companyId } });
  await prisma.salesOrderLine.deleteMany({ where: { order: { companyId } } });
  await prisma.salesOrder.deleteMany({ where: { companyId } });
  await prisma.paymentMethod.deleteMany({ where: { companyId } });

  await prisma.fiscalRiskAlert.deleteMany({ where: { companyId } });
  await prisma.fiscalTransaction.deleteMany({ where: { companyId } });

  // Inventario: capas de costo y sus consumos antes que los movimientos;
  // movimientos antes que variante/almacén/lote; lote antes de variante.
  await prisma.stockCostLayerConsumption.deleteMany({ where: { exitMovement: { companyId } } });
  await prisma.stockCostLayer.deleteMany({ where: { companyId } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId } });
  await prisma.stockLevel.deleteMany({ where: { companyId } });
  await prisma.inventoryLot.deleteMany({ where: { companyId } });
  await prisma.productVariant.deleteMany({ where: { product: { companyId } } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.productCategory.deleteMany({ where: { companyId } });
  await prisma.unitOfMeasure.deleteMany({ where: { companyId } });
  await prisma.warehouse.deleteMany({ where: { companyId } });

  await prisma.journalEntryLineDimension.deleteMany({ where: { line: { journalEntry: { companyId } } } });
  await prisma.journalEntryLineFpaDimension.deleteMany({ where: { line: { journalEntry: { companyId } } } });
  await prisma.journalEntryLine.deleteMany({ where: { journalEntry: { companyId } } });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.treasuryAccount.deleteMany({ where: { companyId } });
  await prisma.arApSettings.deleteMany({ where: { companyId } });
  await prisma.customer.deleteMany({ where: { companyId } });
  await prisma.taxJurisdiction.deleteMany({ where: { companyId } });
  await prisma.accountingPeriod.deleteMany({ where: { companyId } });
  await prisma.accountingSettings.deleteMany({ where: { companyId } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

module.exports = {
  prisma,
  unique,
  createCompany,
  createUser,
  createAccount,
  createOpenPeriod,
  createTreasuryAccount,
  createTaxJurisdiction,
  createCustomer,
  setReceivableAccount,
  buildTreasuryScenario,
  createUnitOfMeasure,
  createWarehouse,
  createPhysicalProduct,
  createServiceProduct,
  buildSalesScenario,
  cleanupCompany,
};
