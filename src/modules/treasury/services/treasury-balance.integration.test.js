// Fase 1 — prueba de integración contra Postgres real: confirma que la
// corrección de doble contabilización de TreasuryAccount.currentBalance
// funciona con el flujo real (cobro operativo de AR + importación de
// extracto bancario del MISMO movimiento), y que el único punto legítimo
// donde un movimiento bancario sin registro previo afecta el saldo
// (matchWithNewEntry) sigue funcionando.
const { prisma, buildTreasuryScenario, cleanupCompany } = require('../../../test-helpers/integration-fixtures');
const arPaymentsService = require('../../accounts-receivable/services/ar-payments.service');
const statementImportService = require('./statement-import.service');
const reconciliationService = require('./reconciliation.service');

let scenario;

beforeEach(async () => {
  scenario = await buildTreasuryScenario();
});

afterEach(async () => {
  await cleanupCompany(scenario.company.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function csvFor(amount, description, date) {
  const iso = date.toISOString().slice(0, 10);
  return `date,description,amount,reference,externalId\n${iso},${description},${amount},,ext-${Date.now()}-${Math.random()}`;
}

describe('Fase 1 — corrección de doble contabilización (TreasuryAccount.currentBalance)', () => {
  test('cobro operativo + importación del mismo movimiento NO duplican el saldo', async () => {
    const { company, user, customer, treasuryAccount } = scenario;
    const paymentDate = new Date();

    // 1) Cobro operativo real: sube el saldo a 100.
    await arPaymentsService.recordPayment(company.id, user.id, {
      customerId: customer.id,
      date: paymentDate,
      treasuryAccountId: treasuryAccount.id,
      amount: 100,
      applications: [],
    });

    const afterPayment = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(afterPayment.currentBalance)).toBe(100);

    // 2) El MISMO movimiento aparece después en el extracto bancario
    // importado (flujo real: se registra a mano, y días después llega el
    // extracto que lo confirma). Antes de la corrección, esto sumaba
    // otros 100 al saldo (doble contabilización, ya confirmado en la
    // auditoría). Ahora la importación no debe tocar el saldo.
    await statementImportService.importBankStatement(company.id, user.id, {
      treasuryAccountId: treasuryAccount.id,
      source: 'CSV',
      fileName: 'extracto.csv',
      fileContent: csvFor(100, 'Cobro cliente', paymentDate),
    });

    const afterImport = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(afterImport.currentBalance)).toBe(100); // sigue en 100, NO 200

    // La importación sigue haciendo su trabajo real: el movimiento
    // bancario queda registrado, sin conciliar todavía.
    const bankTransactions = await prisma.bankTransaction.findMany({ where: { treasuryAccountId: treasuryAccount.id } });
    expect(bankTransactions).toHaveLength(1);
    expect(bankTransactions[0].status).toBe('UNMATCHED');
  });

  test('un movimiento bancario SIN registro previo (ej. cargo del banco) sí ajusta el saldo, solo al generarle un asiento', async () => {
    const { company, user, treasuryAccount, receivableGlAccount } = scenario;
    const today = new Date();

    // Importar un cargo bancario que nunca se registró operativamente
    // (ej. una comisión). La importación NO toca el saldo (igual que en
    // el otro caso).
    await statementImportService.importBankStatement(company.id, user.id, {
      treasuryAccountId: treasuryAccount.id,
      source: 'CSV',
      fileName: 'extracto.csv',
      fileContent: csvFor(-15, 'Comision bancaria', today),
    });

    const afterImport = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(afterImport.currentBalance)).toBe(0);

    const bankTransaction = await prisma.bankTransaction.findFirst({ where: { treasuryAccountId: treasuryAccount.id } });
    expect(bankTransaction).not.toBeNull();

    const reconciliation = await reconciliationService.startReconciliation(company.id, user.id, {
      treasuryAccountId: treasuryAccount.id,
      periodStart: new Date(today.getFullYear(), 0, 1),
      periodEnd: new Date(today.getFullYear(), 11, 31),
      statementStartingBalance: 0,
      statementEndingBalance: -15,
    });

    // Un humano confirma que este movimiento no tiene asiento previo:
    // recién AQUÍ es correcto que el saldo se mueva, una sola vez.
    await reconciliationService.matchWithNewEntry(company.id, reconciliation.id, user.id, {
      bankTransactionId: bankTransaction.id,
      offsetAccountId: receivableGlAccount.id,
      description: 'Comisión bancaria sin registro previo',
    });

    const afterMatch = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(afterMatch.currentBalance)).toBe(-15);

    const matchedTransaction = await prisma.bankTransaction.findUnique({ where: { id: bankTransaction.id } });
    expect(matchedTransaction.status).toBe('MATCHED');
  });
});
