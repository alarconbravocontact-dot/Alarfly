// Fase 6 (secciones 6/9/24/32/51): prueba contra Postgres real los 3
// hallazgos reales de la auditoría de moneda:
//   1) liquidar un cobro/pago/orden de pago/deuda contra una cuenta de
//      tesorería que NO está en la moneda base ya no corrompe el saldo
//      en silencio — se rechaza con un mensaje claro
//      (assertBaseCurrencySettlement, ver fx.rules.js);
//   2) ApPayment ahora admite bankTransactionId, espejo exacto de
//      ArPayment (pendiente heredado de Fase 4, resuelto acá) — sin
//      duplicar el ajuste de saldo;
//   3) el snapshot histórico BCV de un pago a proveedor sobrevive a una
//      tasa nueva registrada después (mismo caso ya probado para AR en
//      Fase 3, ahora también para AP).
const {
  prisma,
  createCompany,
  createUser,
  createAccount,
  createOpenPeriod,
  createTreasuryAccount,
  createVendor,
  setPayableAccount,
  createTaxJurisdiction,
  createUnitOfMeasure,
  createWarehouse,
  createServiceProduct,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const fxService = require('../../../core/fx/fx.service');
const apBillsService = require('../../accounts-payable/services/ap-bills.service');
const apPaymentsService = require('../../accounts-payable/services/ap-payments.service');
const paymentOrdersService = require('./payment-orders.service');
const debtsService = require('./debts.service');
const statementImportService = require('./statement-import.service');

let scenario;

async function buildScenario() {
  const company = await createCompany();
  const user = await createUser(company.id);
  const payableGlAccount = await createAccount(company.id, { type: 'LIABILITY', normalBalance: 'CREDIT' });
  const bankGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  const liabilityAccount = await createAccount(company.id, { type: 'LIABILITY', normalBalance: 'CREDIT' });
  const interestExpenseAccount = await createAccount(company.id, { type: 'EXPENSE', normalBalance: 'DEBIT' });
  await createOpenPeriod(company.id);
  await setPayableAccount(company.id, payableGlAccount.id);
  const vendor = await createVendor(company.id);
  const jurisdiction = await createTaxJurisdiction(company.id);
  const uom = await createUnitOfMeasure(company.id);
  const warehouse = await createWarehouse(company.id);
  const { variant: serviceVariant } = await createServiceProduct(company.id, uom);
  const baseTreasuryAccount = await createTreasuryAccount(company.id, bankGlAccount.id, 100000, 'USD');
  const foreignTreasuryAccount = await createTreasuryAccount(company.id, bankGlAccount.id, 100000, 'VES');

  return {
    company,
    user,
    payableGlAccount,
    bankGlAccount,
    liabilityAccount,
    interestExpenseAccount,
    vendor,
    jurisdiction,
    warehouse,
    serviceVariant,
    baseTreasuryAccount,
    foreignTreasuryAccount,
  };
}

async function createServiceBill(scenario, amount) {
  return apBillsService.createBill(scenario.company.id, scenario.user.id, {
    vendorId: scenario.vendor.id,
    jurisdictionId: scenario.jurisdiction.id,
    expenseAccountId: scenario.interestExpenseAccount.id,
    issueDate: new Date(),
    lines: [{ description: 'Servicio', quantity: 1, unitPrice: amount, variantId: scenario.serviceVariant.id }],
  });
}

beforeEach(async () => {
  scenario = await buildScenario();
});

afterEach(async () => {
  await cleanupCompany(scenario.company.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Coherencia de moneda de liquidación (secciones 6/32)', () => {
  test('un pago directo de AP contra una cuenta en otra moneda se rechaza, no corrompe el saldo', async () => {
    const bill = await createServiceBill(scenario, 100);
    await expect(
      apPaymentsService.recordPayment(scenario.company.id, scenario.user.id, {
        vendorId: scenario.vendor.id,
        treasuryAccountId: scenario.foreignTreasuryAccount.id,
        date: new Date(),
        amount: 100,
        applications: [{ billId: bill.id, amount: 100 }],
      })
    ).rejects.toMatchObject({ code: 'SETTLEMENT_CURRENCY_MISMATCH' });

    const untouched = await prisma.treasuryAccount.findUnique({ where: { id: scenario.foreignTreasuryAccount.id } });
    expect(Number(untouched.currentBalance)).toBe(100000);
  });

  test('crear una Orden de Pago con la moneda de la cuenta correcta pero la cuenta en otra moneda que la base se rechaza', async () => {
    await expect(
      paymentOrdersService.createPaymentOrder(scenario.company.id, scenario.user.id, {
        treasuryAccountId: scenario.foreignTreasuryAccount.id,
        glAccountId: scenario.interestExpenseAccount.id,
        payeeName: 'Beneficiario de prueba',
        amount: 100,
        currency: 'VES',
        description: 'Pago de prueba',
        scheduledDate: new Date(),
      })
    ).rejects.toMatchObject({ code: 'SETTLEMENT_CURRENCY_MISMATCH' });
  });

  test('crear una Orden de Pago con la moneda declarada distinta a la de la cuenta elegida se rechaza (coherencia interna)', async () => {
    await expect(
      paymentOrdersService.createPaymentOrder(scenario.company.id, scenario.user.id, {
        treasuryAccountId: scenario.baseTreasuryAccount.id,
        glAccountId: scenario.interestExpenseAccount.id,
        payeeName: 'Beneficiario de prueba',
        amount: 100,
        currency: 'EUR',
        description: 'Pago de prueba',
        scheduledDate: new Date(),
      })
    ).rejects.toMatchObject({ code: 'ORDER_CURRENCY_MISMATCH' });
  });

  test('crear una Deuda con la misma moneda que la cuenta, pero esa cuenta en otra moneda que la base, se rechaza', async () => {
    await expect(
      debtsService.createDebt(scenario.company.id, scenario.user.id, {
        type: 'LOAN',
        name: 'Préstamo de prueba',
        lender: 'Banco de prueba',
        principalAmount: 1000,
        interestRate: 12,
        currency: 'VES',
        startDate: new Date(),
        installmentCount: 6,
        treasuryAccountId: scenario.foreignTreasuryAccount.id,
        liabilityAccountId: scenario.liabilityAccount.id,
        interestExpenseAccountId: scenario.interestExpenseAccount.id,
      })
    ).rejects.toMatchObject({ code: 'SETTLEMENT_CURRENCY_MISMATCH' });
  });

  test('crear una Deuda con la moneda declarada distinta a la de la cuenta elegida se rechaza (coherencia interna)', async () => {
    await expect(
      debtsService.createDebt(scenario.company.id, scenario.user.id, {
        type: 'LOAN',
        name: 'Préstamo de prueba 2',
        lender: 'Banco de prueba',
        principalAmount: 1000,
        interestRate: 12,
        currency: 'EUR',
        startDate: new Date(),
        installmentCount: 6,
        treasuryAccountId: scenario.baseTreasuryAccount.id,
        liabilityAccountId: scenario.liabilityAccount.id,
        interestExpenseAccountId: scenario.interestExpenseAccount.id,
      })
    ).rejects.toMatchObject({ code: 'DEBT_CURRENCY_MISMATCH' });
  });

  test('un pago directo de AP contra la cuenta en la moneda base sigue funcionando igual que siempre', async () => {
    const bill = await createServiceBill(scenario, 100);
    const payment = await apPaymentsService.recordPayment(scenario.company.id, scenario.user.id, {
      vendorId: scenario.vendor.id,
      treasuryAccountId: scenario.baseTreasuryAccount.id,
      date: new Date(),
      amount: 100,
      applications: [{ billId: bill.id, amount: 100 }],
    });
    expect(Number(payment.amount)).toBe(100);
  });
});

describe('ApPayment ligado a un movimiento bancario real (sección 24, pendiente heredado ya resuelto)', () => {
  function csvFor(amount, description, date) {
    const iso = date.toISOString().slice(0, 10);
    return `date,description,amount,reference,externalId\n${iso},${description},${amount},,ext-${Date.now()}-${Math.random()}`;
  }

  test('pagar contra un movimiento bancario real marca el movimiento MATCHED y descuenta el saldo una sola vez', async () => {
    const bill = await createServiceBill(scenario, 250);
    const today = new Date();

    await statementImportService.importBankStatement(scenario.company.id, scenario.user.id, {
      treasuryAccountId: scenario.baseTreasuryAccount.id,
      source: 'CSV',
      fileName: 'extracto.csv',
      fileContent: csvFor(-250, 'Pago a proveedor', today),
    });
    const bankTransaction = await prisma.bankTransaction.findFirst({ where: { treasuryAccountId: scenario.baseTreasuryAccount.id } });
    expect(bankTransaction.status).toBe('UNMATCHED');

    // La importación en sí NUNCA toca el saldo (mismo invariante ya
    // probado en Fase 1 para AR) — solo el registro operativo lo hace.
    const afterImport = await prisma.treasuryAccount.findUnique({ where: { id: scenario.baseTreasuryAccount.id } });
    expect(Number(afterImport.currentBalance)).toBe(100000);

    const payment = await apPaymentsService.recordPayment(scenario.company.id, scenario.user.id, {
      vendorId: scenario.vendor.id,
      bankTransactionId: bankTransaction.id,
      date: today,
      reference: 'REF-BANK-001',
      applications: [{ billId: bill.id, amount: 250 }],
    });
    expect(payment.bankTransactionId).toBe(bankTransaction.id);
    expect(payment.reference).toBe('REF-BANK-001');

    const afterPayment = await prisma.treasuryAccount.findUnique({ where: { id: scenario.baseTreasuryAccount.id } });
    expect(Number(afterPayment.currentBalance)).toBe(99750); // 100000 - 250, UNA sola vez

    const matched = await prisma.bankTransaction.findUnique({ where: { id: bankTransaction.id } });
    expect(matched.status).toBe('MATCHED');
  });

  test('un movimiento ya conciliado no se puede volver a usar', async () => {
    const bill1 = await createServiceBill(scenario, 100);
    const bill2 = await createServiceBill(scenario, 100);
    const today = new Date();
    await statementImportService.importBankStatement(scenario.company.id, scenario.user.id, {
      treasuryAccountId: scenario.baseTreasuryAccount.id,
      source: 'CSV',
      fileName: 'extracto.csv',
      fileContent: csvFor(-100, 'Pago a proveedor', today),
    });
    const bankTransaction = await prisma.bankTransaction.findFirst({ where: { treasuryAccountId: scenario.baseTreasuryAccount.id } });

    await apPaymentsService.recordPayment(scenario.company.id, scenario.user.id, {
      vendorId: scenario.vendor.id,
      bankTransactionId: bankTransaction.id,
      date: today,
      applications: [{ billId: bill1.id, amount: 100 }],
    });

    await expect(
      apPaymentsService.recordPayment(scenario.company.id, scenario.user.id, {
        vendorId: scenario.vendor.id,
        bankTransactionId: bankTransaction.id,
        date: today,
        applications: [{ billId: bill2.id, amount: 100 }],
      })
    ).rejects.toMatchObject({ code: 'BANK_TRANSACTION_ALREADY_MATCHED' });
  });

  test('un movimiento de ENTRADA (positivo) se rechaza para un pago a proveedor — AP necesita una salida', async () => {
    const bill = await createServiceBill(scenario, 100);
    const today = new Date();
    await statementImportService.importBankStatement(scenario.company.id, scenario.user.id, {
      treasuryAccountId: scenario.baseTreasuryAccount.id,
      source: 'CSV',
      fileName: 'extracto.csv',
      fileContent: csvFor(100, 'Cobro real no un pago', today),
    });
    const bankTransaction = await prisma.bankTransaction.findFirst({ where: { treasuryAccountId: scenario.baseTreasuryAccount.id } });

    await expect(
      apPaymentsService.recordPayment(scenario.company.id, scenario.user.id, {
        vendorId: scenario.vendor.id,
        bankTransactionId: bankTransaction.id,
        date: today,
        applications: [{ billId: bill.id, amount: 100 }],
      })
    ).rejects.toMatchObject({ code: 'BANK_TRANSACTION_NOT_OUTFLOW' });
  });
});

describe('Snapshot histórico BCV en ApPayment (secciones 12/13/51)', () => {
  test('una tasa nueva registrada después no recalcula el pago ya hecho', async () => {
    const bill = await createServiceBill(scenario, 100);

    await fxService.recordRate({ companyId: scenario.company.id, currency: 'VES', rate: 0.025, date: new Date('2026-01-01') });

    const payment = await apPaymentsService.recordPayment(scenario.company.id, scenario.user.id, {
      vendorId: scenario.vendor.id,
      treasuryAccountId: scenario.baseTreasuryAccount.id,
      date: new Date('2026-01-02'),
      foreignCurrency: 'VES',
      foreignAmount: 4000, // 4000 Bs. * 0.025 = 100 USD
      applications: [{ billId: bill.id, amount: 100 }],
    });

    expect(Number(payment.exchangeRate)).toBe(0.025);
    expect(Number(payment.amount)).toBe(100);

    await fxService.recordRate({ companyId: scenario.company.id, currency: 'VES', rate: 0.05, date: new Date('2026-02-01') });

    const stillSame = await prisma.apPayment.findUnique({ where: { id: payment.id } });
    expect(Number(stillSame.exchangeRate)).toBe(0.025);
    expect(Number(stillSame.amount)).toBe(100);
  });
});
