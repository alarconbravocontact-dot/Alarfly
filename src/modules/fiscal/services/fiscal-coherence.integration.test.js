// Fase 7 (secciones 59-64): pruebas obligatorias de coherencia fiscal
// contra Postgres real. La tasa usada en cada caso es la que el propio
// test configura (nunca una regla fiscal universal impuesta) — ver
// sección 59.
const {
  prisma,
  createCompany,
  createUser,
  createAccount,
  createOpenPeriod,
  createTreasuryAccount,
  createTaxJurisdiction,
  createCustomer,
  setReceivableAccount,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const arInvoicesService = require('../../accounts-receivable/services/ar-invoices.service');
const arCreditNotesService = require('../../accounts-receivable/services/ar-credit-notes.service');
const fiscalTransactionsService = require('./fiscal-transactions.service');
const fiscalBooksService = require('./fiscal-books.service');
const taxRatesService = require('./tax-rates.service');
const electronicInvoicingService = require('./electronic-invoicing.service');
const riskRulesService = require('./fiscal-risk-rules.service');

let scenario;

async function buildFiscalSalesScenario() {
  const company = await createCompany();
  const user = await createUser(company.id);
  const bankGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  const receivableGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  const incomeAccount = await createAccount(company.id, { type: 'INCOME', normalBalance: 'CREDIT' });
  const taxGlAccount = await createAccount(company.id, { type: 'LIABILITY', normalBalance: 'CREDIT' });
  await createOpenPeriod(company.id);
  await setReceivableAccount(company.id, receivableGlAccount.id);
  await createTreasuryAccount(company.id, bankGlAccount.id, 0);
  const customer = await createCustomer(company.id);
  const jurisdiction = await createTaxJurisdiction(company.id);

  return { company, user, receivableGlAccount, incomeAccount, taxGlAccount, customer, jurisdiction };
}

async function createIvaRate(scenario, ratePercent, { validFrom = new Date('2026-01-01') } = {}) {
  return taxRatesService.createTaxRate(scenario.company.id, scenario.user.id, {
    jurisdictionId: scenario.jurisdiction.id,
    type: 'VAT',
    code: `IVA_${ratePercent}`,
    name: `IVA ${ratePercent}%`,
    rate: ratePercent,
    appliesTo: 'SALE',
    validFrom,
    glAccountId: scenario.taxGlAccount.id,
  });
}

async function createSaleInvoice(scenario, { subtotal = 100, taxRateId, issueDate = new Date('2026-06-01') } = {}) {
  return arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
    customerId: scenario.customer.id,
    jurisdictionId: scenario.jurisdiction.id,
    incomeAccountId: scenario.incomeAccount.id,
    issueDate,
    taxRateId,
    lines: [{ description: 'Servicio de prueba', quantity: 1, unitPrice: subtotal }],
  });
}

afterEach(async () => {
  if (scenario) await cleanupCompany(scenario.company.id);
  scenario = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Test de coherencia (sección 59): Factura = Fiscal = CxC, con la tasa real configurada', () => {
  test('venta con la tasa configurada en el sistema mantiene coherencia en los 3 dominios', async () => {
    scenario = await buildFiscalSalesScenario();
    const rate = await createIvaRate(scenario, 16);

    const invoice = await createSaleInvoice(scenario, { subtotal: 100, taxRateId: rate.id });

    // Factura: 100 + 16% = 116, sin retención.
    expect(Number(invoice.subtotal)).toBe(100);
    expect(Number(invoice.taxAmount)).toBe(16);
    expect(Number(invoice.withholdingAmount)).toBe(0);
    expect(Number(invoice.totalAmount)).toBe(116);

    // Fiscal: misma cifra exacta, nunca recalculada de forma independiente.
    const fiscalTransaction = await fiscalTransactionsService.getFiscalTransaction(scenario.company.id, invoice.fiscalTransactionId);
    expect(Number(fiscalTransaction.taxBase)).toBe(100);
    expect(Number(fiscalTransaction.taxAmount)).toBe(16);

    // CxC: el saldo abierto de la factura es el total completo (nada cobrado aún).
    const openBalance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    expect(openBalance).toBe(116);

    // Ledger: el asiento de la transacción fiscal está balanceado.
    const entry = await prisma.journalEntry.findUnique({
      where: { id: fiscalTransaction.journalEntryId },
      include: { lines: true },
    });
    const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(116);
  });
});

describe('Test de nota de crédito (sección 60): sin doble impacto fiscal', () => {
  test('una nota de crédito por el 100% deja la factura saldada (PAID), sin generar una segunda FiscalTransaction', async () => {
    scenario = await buildFiscalSalesScenario();
    const rate = await createIvaRate(scenario, 16);
    const invoice = await createSaleInvoice(scenario, { subtotal: 100, taxRateId: rate.id });

    const countBefore = await prisma.fiscalTransaction.count({ where: { companyId: scenario.company.id } });
    expect(countBefore).toBe(1);

    const note = await arCreditNotesService.createCreditNote(scenario.company.id, scenario.user.id, {
      invoiceId: invoice.id,
      type: 'CREDIT',
      reason: 'Devolución total',
      amount: 116,
      date: new Date('2026-06-02'),
    });

    // La nota generó su PROPIO asiento (nunca reutiliza el de la venta).
    expect(note.journalEntryId).not.toBe((await fiscalTransactionsService.getFiscalTransaction(scenario.company.id, invoice.fiscalTransactionId)).journalEntryId);

    // Nunca se creó una segunda FiscalTransaction para la nota — el
    // motor fiscal solo se invoca una vez, al facturar.
    const countAfter = await prisma.fiscalTransaction.count({ where: { companyId: scenario.company.id } });
    expect(countAfter).toBe(1);

    const invoiceAfter = await arInvoicesService.getInvoice(scenario.company.id, invoice.id);
    expect(Number(invoiceAfter.totalAmount)).toBe(0);
    expect(invoiceAfter.status).toBe('PAID'); // Fase 7: antes leía OPEN incorrectamente.

    // El libro fiscal ahora refleja la nota — no se queda ciego a ella.
    const salesBook = await fiscalBooksService.getSalesBook(scenario.company.id, { from: new Date('2026-06-01'), to: new Date('2026-06-30') });
    expect(salesBook.creditNotes).toHaveLength(1);
    expect(salesBook.creditNotes[0].amount).toBe('116.00');
    // Base+Impuesto (116) ajustado por la nota (-116) = 0.
    expect(salesBook.netTotal).toBe('0.00');
  });
});

describe('Test de reversión (sección 61): trazable vía Ledger y Auditoría, nunca DELETE', () => {
  test('la nota de crédito queda auditada y el asiento original de la venta nunca se toca', async () => {
    scenario = await buildFiscalSalesScenario();
    const rate = await createIvaRate(scenario, 16);
    const invoice = await createSaleInvoice(scenario, { subtotal: 100, taxRateId: rate.id });
    const originalFiscalTransaction = await fiscalTransactionsService.getFiscalTransaction(scenario.company.id, invoice.fiscalTransactionId);

    const note = await arCreditNotesService.createCreditNote(scenario.company.id, scenario.user.id, {
      invoiceId: invoice.id,
      type: 'CREDIT',
      reason: 'Reversión de prueba',
      amount: 116,
      date: new Date('2026-06-02'),
    });

    // El asiento ORIGINAL de la venta sigue exactamente igual — nunca se
    // edita ni se borra (mismo criterio que core/ledger.reverseEntry).
    const originalEntryStill = await prisma.journalEntry.findUnique({ where: { id: originalFiscalTransaction.journalEntryId } });
    expect(originalEntryStill).not.toBeNull();
    expect(originalEntryStill.status).toBe('APPROVED');

    const logs = await prisma.auditLog.findMany({ where: { companyId: scenario.company.id, entityType: 'ArCreditNote', entityId: note.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('ar_credit_note.created');
    expect(logs[0].userId).toBe(scenario.user.id);
  });
});

describe('Test multiempresa (sección 62): aislamiento fiscal', () => {
  test('impuestos, transacciones y libros de una empresa nunca se mezclan con los de otra', async () => {
    const scenarioA = await buildFiscalSalesScenario();
    const scenarioB = await buildFiscalSalesScenario();
    try {
      const rateA = await createIvaRate(scenarioA, 16);
      const rateB = await createIvaRate(scenarioB, 21);

      await createSaleInvoice(scenarioA, { subtotal: 100, taxRateId: rateA.id });
      await createSaleInvoice(scenarioB, { subtotal: 200, taxRateId: rateB.id });

      const transactionsA = await fiscalTransactionsService.listFiscalTransactions(scenarioA.company.id, {});
      const transactionsB = await fiscalTransactionsService.listFiscalTransactions(scenarioB.company.id, {});
      expect(transactionsA).toHaveLength(1);
      expect(transactionsB).toHaveLength(1);
      expect(Number(transactionsA[0].taxBase)).toBe(100);
      expect(Number(transactionsB[0].taxBase)).toBe(200);

      const ratesA = await taxRatesService.listTaxRates(scenarioA.company.id, {});
      expect(ratesA.every((r) => r.companyId === scenarioA.company.id)).toBe(true);
      expect(ratesA.some((r) => r.id === rateB.id)).toBe(false);

      const bookA = await fiscalBooksService.getSalesBook(scenarioA.company.id, { from: new Date('2026-01-01'), to: new Date('2026-12-31') });
      expect(bookA.lines).toHaveLength(1);
      expect(bookA.totalBase).toBe('100.00');
    } finally {
      await cleanupCompany(scenarioA.company.id);
      await cleanupCompany(scenarioB.company.id);
    }
  });
});

describe('Test de históricos (sección 63): cambiar la configuración fiscal no recalcula el pasado', () => {
  test('cerrar una tasa y crear una tasa nueva no afecta una factura ya emitida con la tasa anterior', async () => {
    scenario = await buildFiscalSalesScenario();
    const oldRate = await createIvaRate(scenario, 16, { validFrom: new Date('2026-01-01') });

    const invoice = await createSaleInvoice(scenario, { subtotal: 100, taxRateId: oldRate.id, issueDate: new Date('2026-03-01') });
    expect(Number(invoice.taxAmount)).toBe(16);

    // Se cierra la tasa vieja y nace una nueva, más alta, vigente desde hoy.
    await taxRatesService.closeTaxRate(scenario.company.id, oldRate.id, scenario.user.id, new Date('2026-06-30'));
    await createIvaRate(scenario, 19, { validFrom: new Date('2026-07-01') });

    const invoiceAfter = await arInvoicesService.getInvoice(scenario.company.id, invoice.id);
    expect(Number(invoiceAfter.taxAmount)).toBe(16); // sigue en 16, nunca 19
    expect(Number(invoiceAfter.totalAmount)).toBe(116);

    const fiscalTransactionAfter = await fiscalTransactionsService.getFiscalTransaction(scenario.company.id, invoice.fiscalTransactionId);
    expect(Number(fiscalTransactionAfter.taxAmount)).toBe(16);
  });
});

describe('Test de idempotencia y atomicidad (secciones 25/56/57/64)', () => {
  test('una regla de riesgo bloqueante rechaza ANTES de tocar Ledger/Fiscal — no queda ningún rastro huérfano', async () => {
    scenario = await buildFiscalSalesScenario();
    const rate = await createIvaRate(scenario, 16);

    await riskRulesService.createRule(scenario.company.id, scenario.user.id, {
      name: 'Bloqueo de prueba',
      description: 'Bloquea toda venta para probar atomicidad',
      condition: { all: [{ field: 'type', op: 'eq', value: 'SALE' }] },
      severity: 'BLOCKING',
    });

    const entriesBefore = await prisma.journalEntry.count({ where: { companyId: scenario.company.id } });
    const fiscalBefore = await prisma.fiscalTransaction.count({ where: { companyId: scenario.company.id } });
    const invoicesBefore = await prisma.arInvoice.count({ where: { companyId: scenario.company.id } });

    await expect(createSaleInvoice(scenario, { subtotal: 100, taxRateId: rate.id })).rejects.toMatchObject({
      code: 'FISCAL_RISK_BLOCKED',
    });

    const entriesAfter = await prisma.journalEntry.count({ where: { companyId: scenario.company.id } });
    const fiscalAfter = await prisma.fiscalTransaction.count({ where: { companyId: scenario.company.id } });
    const invoicesAfter = await prisma.arInvoice.count({ where: { companyId: scenario.company.id } });

    expect(entriesAfter).toBe(entriesBefore);
    expect(fiscalAfter).toBe(fiscalBefore);
    expect(invoicesAfter).toBe(invoicesBefore);
  });

  test('generar un comprobante electrónico dos veces sobre la MISMA transacción fiscal se rechaza (no duplica el documento)', async () => {
    scenario = await buildFiscalSalesScenario();
    const rate = await createIvaRate(scenario, 16);
    const invoice = await createSaleInvoice(scenario, { subtotal: 100, taxRateId: rate.id });

    await electronicInvoicingService.generateDocument(scenario.company.id, scenario.user.id, invoice.fiscalTransactionId);
    const docsAfterFirst = await prisma.fiscalElectronicDocument.count({ where: { companyId: scenario.company.id } });
    expect(docsAfterFirst).toBe(1);

    await expect(
      electronicInvoicingService.generateDocument(scenario.company.id, scenario.user.id, invoice.fiscalTransactionId)
    ).rejects.toThrow();

    const docsAfterSecond = await prisma.fiscalElectronicDocument.count({ where: { companyId: scenario.company.id } });
    expect(docsAfterSecond).toBe(1); // nunca 2
  });
});
