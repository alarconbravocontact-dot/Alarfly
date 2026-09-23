// Fase 5 — prueba de integración contra Postgres real (sin mocks) de la
// capa de lectura consolidada (Resumen financiero, secciones 7/42/45/46
// del prompt): Dinero (saldo consolidado, múltiples cuentas, monedas),
// CxC/CxP (antigüedad real), Financiamiento (deuda real), Liquidez
// (entradas/salidas esperadas reales) y aislamiento multiempresa — todo
// a través de UN solo punto de entrada (getFinanceSummary), verificando
// que cada número viene de datos reales creados con los motores de
// siempre (nunca insertados a mano).
const {
  prisma,
  buildSalesScenario,
  createVendor,
  setPayableAccount,
  createAccount,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const arInvoicesService = require('../../accounts-receivable/services/ar-invoices.service');
const apBillsService = require('../../accounts-payable/services/ap-bills.service');
const debtsService = require('../../treasury/services/debts.service');
const paymentOrdersService = require('../../treasury/services/payment-orders.service');
const financeSummaryService = require('./finance-summary.service');

let scenario;

afterEach(async () => {
  if (scenario) await cleanupCompany(scenario.company.id);
  scenario = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function inDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

describe('finance-summary.service.getFinanceSummary — Dinero, CxC, CxP, Financiamiento, Liquidez', () => {
  test('consolida montos reales de AR/AP/Deuda/Órdenes de pago, cada uno de su motor real', async () => {
    scenario = await buildSalesScenario();
    const { company, user, customer, jurisdiction, serviceVariant, treasuryAccount, incomeAccount } = scenario;

    // CxP real: proveedor + factura de servicio.
    const vendor = await createVendor(company.id);
    const payableGlAccount = await createAccount(company.id, { type: 'LIABILITY', normalBalance: 'CREDIT' });
    await setPayableAccount(company.id, payableGlAccount.id);
    const expenseAccount = await createAccount(company.id, { type: 'EXPENSE', normalBalance: 'DEBIT' });

    // Financiamiento real: préstamo desembolsado.
    const liabilityAccount = await createAccount(company.id, { type: 'LIABILITY', normalBalance: 'CREDIT' });
    const interestExpenseAccount = await createAccount(company.id, { type: 'EXPENSE', normalBalance: 'DEBIT' });

    // CxC real: factura de servicio con vencimiento dentro del horizonte
    // de la Previsión de Liquidez (8 semanas).
    const invoice = await arInvoicesService.createInvoice(company.id, user.id, {
      customerId: customer.id,
      jurisdictionId: jurisdiction.id,
      incomeAccountId: incomeAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio de consultoría', quantity: 1, unitPrice: 500, variantId: serviceVariant.id }],
    });

    const bill = await apBillsService.createBill(company.id, user.id, {
      vendorId: vendor.id,
      jurisdictionId: jurisdiction.id,
      expenseAccountId: expenseAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio de limpieza', quantity: 1, unitPrice: 120, variantId: serviceVariant.id }],
    });

    const debt = await debtsService.createDebt(company.id, user.id, {
      type: 'LOAN',
      name: 'Préstamo de prueba',
      lender: 'Banco de prueba',
      principalAmount: 1000,
      interestRate: 12,
      currency: 'USD',
      startDate: new Date(),
      installmentCount: 6,
      treasuryAccountId: treasuryAccount.id,
      liabilityAccountId: liabilityAccount.id,
      interestExpenseAccountId: interestExpenseAccount.id,
    });
    await debtsService.disburseLoan(company.id, debt.id, user.id);

    const order = await paymentOrdersService.createPaymentOrder(company.id, user.id, {
      treasuryAccountId: treasuryAccount.id,
      glAccountId: expenseAccount.id,
      payeeName: 'Proveedor de servicios varios',
      amount: 75,
      currency: 'USD',
      description: 'Pago pendiente de aprobar',
      scheduledDate: inDays(10),
    });

    const summary = await financeSummaryService.getFinanceSummary(company.id);

    // Dinero: el préstamo desembolsado (1000) sí entró a la cuenta real.
    expect(Number(summary.cashOnHand)).toBeCloseTo(1000, 2);
    expect(Number(summary.availableLiquidity)).toBeGreaterThanOrEqual(Number(summary.cashOnHand));

    // CxC: exactamente el total de la factura de venta recién creada.
    expect(Number(summary.totalReceivable)).toBeCloseTo(Number(invoice.totalAmount), 2);

    // CxP: exactamente el total de la factura de compra recién creada.
    expect(Number(summary.totalPayable)).toBeCloseTo(Number(bill.totalAmount), 2);

    // Financiamiento: el saldo pendiente real del préstamo desembolsado.
    expect(Number(summary.totalDebt)).toBeCloseTo(1000, 2);

    // Comprometido: la orden de pago recién creada, todavía DRAFT.
    expect(Number(summary.committedPayments)).toBeCloseTo(75, 2);

    // Liquidez (próximas 8 semanas): la factura de venta due en pocos
    // días cuenta como entrada esperada; la de compra, como salida.
    expect(Number(summary.expectedNearTermInflows)).toBeGreaterThanOrEqual(Number(invoice.totalAmount));
    expect(Number(summary.expectedNearTermOutflows)).toBeGreaterThanOrEqual(Number(bill.totalAmount));

    expect(summary.missingExchangeRates).toEqual([]);
    void order;
  });

  test('aislamiento multiempresa: el resumen de una empresa nunca incluye montos de otra', async () => {
    scenario = await buildSalesScenario();
    const { company, user, customer, jurisdiction, serviceVariant, incomeAccount } = scenario;

    await arInvoicesService.createInvoice(company.id, user.id, {
      customerId: customer.id,
      jurisdictionId: jurisdiction.id,
      incomeAccountId: incomeAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 999, variantId: serviceVariant.id }],
    });

    const other = await buildSalesScenario();
    try {
      const otherSummary = await financeSummaryService.getFinanceSummary(other.company.id);
      // La empresa B, recién creada y sin facturas propias, no ve ni un
      // centavo de lo que se facturó en la empresa A.
      expect(Number(otherSummary.totalReceivable)).toBe(0);
      expect(Number(otherSummary.cashOnHand)).toBe(0);
    } finally {
      await cleanupCompany(other.company.id);
    }

    const summary = await financeSummaryService.getFinanceSummary(company.id);
    expect(Number(summary.totalReceivable)).toBeCloseTo(999 * 1, 0); // sigue viendo SU propia factura, sin contaminar
  });
});
