// Fase 3 — Venta Rápida: prueba del flujo completo pedida
// explícitamente (punto 41), contra Postgres real. Cubre el caso de
// uso principal (producto físico + servicio + cobro en un solo llamado)
// y la conversión BCV con snapshot histórico (punto 24/47).
const {
  prisma,
  cleanupCompany,
  buildSalesScenario,
} = require('../../../test-helpers/integration-fixtures');
const quickSaleService = require('./quick-sale.service');
const arPaymentsService = require('../../accounts-receivable/services/ar-payments.service');
const fxService = require('../../../core/fx/fx.service');

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

describe('Venta Rápida — flujo completo (punto 20/41)', () => {
  test('vende producto físico + servicio y cobra de contado, todo en una sola llamada', async () => {
    const { company, user, customer, variant, serviceVariant, warehouse, jurisdiction, incomeAccount, treasuryAccount } = scenario;

    const result = await quickSaleService.quickSale(company.id, user.id, {
      customerId: customer.id,
      jurisdictionId: jurisdiction.id,
      incomeAccountId: incomeAccount.id,
      issueDate: new Date(),
      lines: [
        { description: 'Producto físico', variantId: variant.id, warehouseId: warehouse.id, quantity: 4, unitPrice: 25 },
        { description: 'Servicio', variantId: serviceVariant.id, quantity: 1, unitPrice: 50 },
      ],
      payment: { treasuryAccountId: treasuryAccount.id, amount: 150 },
    });

    expect(result.invoice.totalAmount.toString()).toBe('150');
    expect(result.payment.amount.toString()).toBe('150');

    // La factura queda pagada de una vez (aplicación automática a la
    // única factura, vía applyFullyToInvoiceId).
    const refreshedInvoice = await prisma.arInvoice.findUnique({ where: { id: result.invoice.id } });
    expect(refreshedInvoice.status).toBe('PAID');
    expect(Number(refreshedInvoice.paidAmount)).toBe(150);

    // El producto físico sí generó salida real; el servicio no.
    const stock = await prisma.stockLevel.findFirst({ where: { variantId: variant.id } });
    expect(Number(stock.quantityOnHand)).toBe(96); // 100 - 4
    const movements = await prisma.inventoryMovement.findMany({ where: { referenceType: 'ArInvoice', referenceId: result.invoice.id } });
    expect(movements).toHaveLength(1); // solo la línea física
    expect(movements[0].variantId).toBe(variant.id);
  });

  test('sin cliente indicado, usa "Consumidor Final" solo si está configurado — si no, rechaza con mensaje claro', async () => {
    const { company, user, jurisdiction, incomeAccount, variant, warehouse } = scenario;

    await expect(
      quickSaleService.quickSale(company.id, user.id, {
        jurisdictionId: jurisdiction.id,
        incomeAccountId: incomeAccount.id,
        issueDate: new Date(),
        lines: [{ description: 'Producto físico', variantId: variant.id, warehouseId: warehouse.id, quantity: 1, unitPrice: 10 }],
      })
    ).rejects.toThrow(/consumidor final/i);

    // Configurado el "Consumidor Final", la misma venta ya funciona sin pedir cliente.
    const defaultCustomer = await prisma.customer.create({ data: { companyId: company.id, name: 'Consumidor Final' } });
    await prisma.arApSettings.update({ where: { companyId: company.id }, data: { defaultCustomerId: defaultCustomer.id } });

    const result = await quickSaleService.quickSale(company.id, user.id, {
      jurisdictionId: jurisdiction.id,
      incomeAccountId: incomeAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Producto físico', variantId: variant.id, warehouseId: warehouse.id, quantity: 1, unitPrice: 10 }],
    });
    expect(result.invoice.customerId).toBe(defaultCustomer.id);
  });
});

describe('Cobro en Bs. / BCV (punto 24/47)', () => {
  test('guarda el snapshot histórico de la tasa — una tasa nueva después no recalcula el cobro ya hecho', async () => {
    const { company, user, customer, treasuryAccount } = scenario;

    await fxService.recordRate({ companyId: company.id, currency: 'VES', rate: 0.025, date: new Date('2026-01-01') });

    const payment = await arPaymentsService.recordPayment(company.id, user.id, {
      customerId: customer.id,
      date: new Date('2026-01-02'),
      treasuryAccountId: treasuryAccount.id,
      foreignCurrency: 'VES',
      foreignAmount: 4000, // 4000 Bs. * 0.025 = 100 USD
      applications: [],
    });

    expect(payment.foreignCurrency).toBe('VES');
    expect(Number(payment.foreignAmount)).toBe(4000);
    expect(Number(payment.exchangeRate)).toBe(0.025);
    expect(Number(payment.amount)).toBe(100); // convertido a la moneda base (USD), snapshot

    // Cambia la tasa BCV DESPUÉS — el cobro histórico no se toca.
    await fxService.recordRate({ companyId: company.id, currency: 'VES', rate: 0.05, date: new Date('2026-02-01') });

    const stillSame = await prisma.arPayment.findUnique({ where: { id: payment.id } });
    expect(Number(stillSame.exchangeRate)).toBe(0.025); // sigue siendo la tasa vigente al momento del cobro
    expect(Number(stillSame.amount)).toBe(100); // nunca se recalculó
  });

  test('sin tasa registrada para esa fecha, rechaza con un mensaje claro en vez de inventar una conversión', async () => {
    const { company, user, customer, treasuryAccount } = scenario;
    await expect(
      arPaymentsService.recordPayment(company.id, user.id, {
        customerId: customer.id,
        date: new Date('2020-01-01'),
        treasuryAccountId: treasuryAccount.id,
        foreignCurrency: 'EUR',
        foreignAmount: 10,
        applications: [],
      })
    ).rejects.toThrow(/tasa de cambio/i);
  });
});
