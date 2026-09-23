// Fase 5 — prueba de integración contra Postgres real (sin mocks) de la
// corrección de `reverseMatch` (punto 11 / secciones 43-44 del prompt):
// antes de esta fase, deshacer un emparejamiento nunca ajustaba
// TreasuryAccount.currentBalance, ni siquiera cuando el emparejamiento
// había generado su propio asiento y su propio movimiento de saldo
// (matchWithNewEntry). Ahora `ReconciliationMatch.generatedNewEntry`
// distingue ese único caso real del resto (emparejar contra un asiento
// YA existente, que nunca tocó el saldo), y reverseMatch reacciona
// distinto según cuál sea.
const {
  prisma,
  buildTreasuryScenario,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
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

async function importOneTransaction(companyId, userId, treasuryAccountId, amount, description, date) {
  await statementImportService.importBankStatement(companyId, userId, {
    treasuryAccountId,
    source: 'CSV',
    fileName: 'extracto.csv',
    fileContent: csvFor(amount, description, date),
  });
  return prisma.bankTransaction.findFirst({ where: { treasuryAccountId, description }, orderBy: { createdAt: 'desc' } });
}

describe('reverseMatch — emparejamiento que generó su propio asiento (matchWithNewEntry)', () => {
  test('deshacerlo devuelve el saldo EXACTO a como estaba, reversa el asiento y desempareja el movimiento', async () => {
    const { company, user, treasuryAccount, receivableGlAccount } = scenario;
    const today = new Date();

    const bankTransaction = await importOneTransaction(company.id, user.id, treasuryAccount.id, -15, 'Comision bancaria', today);
    const reconciliation = await reconciliationService.startReconciliation(company.id, user.id, {
      treasuryAccountId: treasuryAccount.id,
      periodStart: new Date(today.getFullYear(), 0, 1),
      periodEnd: new Date(today.getFullYear(), 11, 31),
      statementStartingBalance: 0,
      statementEndingBalance: -15,
    });

    const { match, journalEntry } = await reconciliationService.matchWithNewEntry(company.id, reconciliation.id, user.id, {
      bankTransactionId: bankTransaction.id,
      offsetAccountId: receivableGlAccount.id,
      description: 'Comisión bancaria sin registro previo',
    });
    expect(match.generatedNewEntry).toBe(true);

    const afterMatch = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(afterMatch.currentBalance)).toBe(-15);

    const reversed = await reconciliationService.reverseMatch(company.id, reconciliation.id, user.id, match.id);
    expect(reversed.status).toBe('REVERSED');

    // El saldo vuelve EXACTO a 0 — nunca "recalculado desde cero",
    // literalmente el mismo monto aplicado en sentido contrario.
    const afterReverse = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(afterReverse.currentBalance)).toBe(0);

    // El movimiento bancario vuelve a quedar disponible para conciliar.
    const bankTransactionAfter = await prisma.bankTransaction.findUnique({ where: { id: bankTransaction.id } });
    expect(bankTransactionAfter.status).toBe('UNMATCHED');
    expect(bankTransactionAfter.matchedJournalEntryLineId).toBeNull();

    // El asiento ORIGINAL nunca se edita ni se borra — queda igual,
    // aprobado, y aparece un asiento espejo que lo reversa (mismo
    // patrón que ya usa core/ledger.reverseEntry en todo el proyecto).
    const originalEntry = await prisma.journalEntry.findUnique({ where: { id: journalEntry.id } });
    expect(originalEntry.status).toBe('APPROVED');
    const mirrorEntry = await prisma.journalEntry.findFirst({ where: { reversalOfId: journalEntry.id } });
    expect(mirrorEntry).not.toBeNull();
    expect(mirrorEntry.status).toBe('APPROVED');
  });

  test('doble reversión (deshacer dos veces el mismo match) — la segunda se rechaza, el saldo no se mueve una segunda vez', async () => {
    const { company, user, treasuryAccount, receivableGlAccount } = scenario;
    const today = new Date();

    const bankTransaction = await importOneTransaction(company.id, user.id, treasuryAccount.id, 50, 'Deposito sin registro', today);
    const reconciliation = await reconciliationService.startReconciliation(company.id, user.id, {
      treasuryAccountId: treasuryAccount.id,
      periodStart: new Date(today.getFullYear(), 0, 1),
      periodEnd: new Date(today.getFullYear(), 11, 31),
      statementStartingBalance: 0,
      statementEndingBalance: 50,
    });
    const { match } = await reconciliationService.matchWithNewEntry(company.id, reconciliation.id, user.id, {
      bankTransactionId: bankTransaction.id,
      offsetAccountId: receivableGlAccount.id,
      description: 'Depósito sin registro previo',
    });

    await reconciliationService.reverseMatch(company.id, reconciliation.id, user.id, match.id);
    const balanceAfterFirstReverse = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(balanceAfterFirstReverse.currentBalance)).toBe(0);

    await expect(reconciliationService.reverseMatch(company.id, reconciliation.id, user.id, match.id)).rejects.toMatchObject({
      code: 'ALREADY_REVERSED',
    });

    // El saldo sigue en 0 — la segunda reversión NO se aplicó una
    // segunda vez (no quedó en +50 por revertir algo que ya no era
    // válido revertir).
    const balanceAfterSecondAttempt = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(balanceAfterSecondAttempt.currentBalance)).toBe(0);
  });

  test('intentar reversar el match de otra empresa se rechaza (aislamiento multiempresa)', async () => {
    const { company, user, treasuryAccount, receivableGlAccount } = scenario;
    const today = new Date();
    const bankTransaction = await importOneTransaction(company.id, user.id, treasuryAccount.id, -8, 'Comision otra empresa', today);
    const reconciliation = await reconciliationService.startReconciliation(company.id, user.id, {
      treasuryAccountId: treasuryAccount.id,
      periodStart: new Date(today.getFullYear(), 0, 1),
      periodEnd: new Date(today.getFullYear(), 11, 31),
      statementStartingBalance: 0,
      statementEndingBalance: -8,
    });
    const { match } = await reconciliationService.matchWithNewEntry(company.id, reconciliation.id, user.id, {
      bankTransactionId: bankTransaction.id,
      offsetAccountId: receivableGlAccount.id,
      description: 'Comisión',
    });

    const other = await buildTreasuryScenario();
    try {
      await expect(
        reconciliationService.reverseMatch(other.company.id, reconciliation.id, other.user.id, match.id)
      ).rejects.toMatchObject({ code: 'MATCH_NOT_FOUND' });

      // El saldo de la Empresa A no se tocó por el intento fallido de la B.
      const balance = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
      expect(Number(balance.currentBalance)).toBe(-8);
    } finally {
      await cleanupCompany(other.company.id);
    }
  });
});

describe('reverseMatch — emparejamiento contra un asiento YA existente (manualMatch/runAutomaticMatching)', () => {
  test('deshacerlo solo desempareja: nunca toca el saldo ni el asiento original (que es de otro origen, ej. un cobro real)', async () => {
    const { company, user, customer, treasuryAccount } = scenario;
    const paymentDate = new Date();

    // Cobro operativo real: postea su propio asiento (débito banco,
    // crédito CxC) y sube el saldo a 100 — el único punto legítimo que
    // debe tocar el saldo para ESTE dinero.
    const payment = await arPaymentsService.recordPayment(company.id, user.id, {
      customerId: customer.id,
      date: paymentDate,
      treasuryAccountId: treasuryAccount.id,
      amount: 100,
      applications: [],
    });
    const paymentLine = await prisma.journalEntryLine.findFirst({
      where: { journalEntryId: payment.journalEntryId, accountId: treasuryAccount.glAccountId },
    });

    const bankTransaction = await importOneTransaction(company.id, user.id, treasuryAccount.id, 100, 'Cobro cliente', paymentDate);
    const reconciliation = await reconciliationService.startReconciliation(company.id, user.id, {
      treasuryAccountId: treasuryAccount.id,
      periodStart: new Date(paymentDate.getFullYear(), 0, 1),
      periodEnd: new Date(paymentDate.getFullYear(), 11, 31),
      statementStartingBalance: 0,
      statementEndingBalance: 100,
    });

    const match = await reconciliationService.manualMatch(company.id, reconciliation.id, user.id, {
      bankTransactionId: bankTransaction.id,
      journalEntryLineId: paymentLine.id,
    });
    expect(match.generatedNewEntry).toBe(false);

    const balanceAfterMatch = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(balanceAfterMatch.currentBalance)).toBe(100); // el cobro ya lo había dejado en 100

    await reconciliationService.reverseMatch(company.id, reconciliation.id, user.id, match.id);

    // El saldo se queda en 100 — el cobro real sigue siendo válido,
    // deshacer la conciliación no lo anula.
    const balanceAfterReverse = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(balanceAfterReverse.currentBalance)).toBe(100);

    // El asiento del cobro real sigue intacto, aprobado, SIN ningún
    // reverso generado — reverseMatch nunca lo tocó.
    const originalEntry = await prisma.journalEntry.findUnique({ where: { id: payment.journalEntryId } });
    expect(originalEntry.status).toBe('APPROVED');
    const mirrorEntry = await prisma.journalEntry.findFirst({ where: { reversalOfId: payment.journalEntryId } });
    expect(mirrorEntry).toBeNull();

    const bankTransactionAfter = await prisma.bankTransaction.findUnique({ where: { id: bankTransaction.id } });
    expect(bankTransactionAfter.status).toBe('UNMATCHED');
  });
});

// Sección 44 del prompt: re-confirmar explícitamente, dentro de la
// batería de pruebas de Fase 5, que el problema de doble contabilización
// que corrigió Fase 1 sigue corregido (cobro operativo + importación del
// mismo movimiento no duplican el saldo). Mismo escenario que ya prueba
// treasury-balance.integration.test.js — acá solo se re-verifica como
// parte del checklist explícito de esta fase, sin duplicar esa prueba
// como fuente de verdad.
describe('Fase 5 — re-confirmación de no-doble-conteo (sección 44)', () => {
  test('cobro operativo + importación del mismo movimiento bancario no duplican TreasuryAccount.currentBalance', async () => {
    const { company, user, customer, treasuryAccount } = scenario;
    const paymentDate = new Date();

    await arPaymentsService.recordPayment(company.id, user.id, {
      customerId: customer.id,
      date: paymentDate,
      treasuryAccountId: treasuryAccount.id,
      amount: 250,
      applications: [],
    });
    const afterPayment = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(afterPayment.currentBalance)).toBe(250);

    await importOneTransaction(company.id, user.id, treasuryAccount.id, 250, 'Cobro cliente confirmacion', paymentDate);
    const afterImport = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAccount.id } });
    expect(Number(afterImport.currentBalance)).toBe(250); // sigue en 250, no 500
  });
});
