// Fase 1 — pruebas de integración contra Postgres real (sin mocks) del
// Unit of Work y de la integración del Ledger con una transacción
// externa. Cubren exactamente los escenarios pedidos: postEntry con y
// sin tx externa, rollback completo ante un fallo deliberado a mitad de
// una operación, y que el Unit of Work reutiliza una transacción ya
// abierta en vez de anidar una nueva.
const {
  prisma,
  createCompany,
  createUser,
  createAccount,
  createOpenPeriod,
  cleanupCompany,
} = require('../../test-helpers/integration-fixtures');
const ledgerService = require('./ledger.service');
const { withTransaction } = require('../database/unit-of-work');

let company;
let user;
let debitAccount;
let creditAccount;

beforeAll(async () => {
  company = await createCompany();
  user = await createUser(company.id);
  debitAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  creditAccount = await createAccount(company.id, { type: 'INCOME', normalBalance: 'CREDIT' });
  await createOpenPeriod(company.id);
});

afterAll(async () => {
  await cleanupCompany(company.id);
  await prisma.$disconnect();
});

function entryData(overrides = {}) {
  return {
    companyId: company.id,
    date: new Date(),
    description: 'Asiento de prueba',
    lines: [
      { accountId: debitAccount.id, debit: 100, credit: 0 },
      { accountId: creditAccount.id, debit: 0, credit: 100 },
    ],
    createdByUserId: user.id,
    autoApprove: true,
    sourceModule: 'test',
    ...overrides,
  };
}

describe('Ledger — postEntry sin transacción externa (comportamiento de siempre)', () => {
  test('crea el asiento normalmente, con su propia transacción', async () => {
    const entry = await ledgerService.postEntry(entryData());
    expect(entry.id).toBeDefined();
    expect(entry.status).toBe('APPROVED');

    const stored = await prisma.journalEntry.findUnique({ where: { id: entry.id }, include: { lines: true } });
    expect(stored).not.toBeNull();
    expect(stored.lines).toHaveLength(2);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'JournalEntry', entityId: entry.id, action: 'journal_entry.created' },
    });
    expect(audit).not.toBeNull();
  });
});

describe('Ledger — postEntry con transacción externa (Fase 1: Unit of Work)', () => {
  test('participa de la transacción del llamador: si el llamador confirma, todo queda aplicado', async () => {
    const account = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });

    const result = await prisma.$transaction(async (tx) => {
      const entry = await ledgerService.postEntry(entryData(), tx);
      const updatedAccount = await tx.account.update({ where: { id: account.id }, data: { description: 'tocada-en-la-misma-tx' } });
      return { entry, updatedAccount };
    });

    const storedEntry = await prisma.journalEntry.findUnique({ where: { id: result.entry.id } });
    expect(storedEntry).not.toBeNull();
    const storedAccount = await prisma.account.findUnique({ where: { id: account.id } });
    expect(storedAccount.description).toBe('tocada-en-la-misma-tx');
  });

  // Test crítico de atomicidad (pedido explícitamente): Documento →
  // Ledger → error deliberado → ROLLBACK completo. Ni el asiento, ni el
  // "documento" (acá representado por la cuenta que se muta como
  // stand-in del documento de negocio, mismo patrón real que usan
  // ar-invoices/ap-bills/inventory-movements: postEntry(data, tx)
  // seguido de una escritura de dominio en la misma tx), ni la auditoría
  // de éxito deben quedar registrados.
  test('si el llamador falla DESPUÉS de postEntry, revierte el asiento, el documento y no deja auditoría de éxito', async () => {
    const account = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
    let capturedEntryId = null;

    await expect(
      prisma.$transaction(async (tx) => {
        const entry = await ledgerService.postEntry(entryData({ description: 'Asiento que debe revertirse' }), tx);
        capturedEntryId = entry.id;

        // "documento de negocio" simulado: se aplica en la MISMA tx.
        await tx.account.update({ where: { id: account.id }, data: { description: 'no-deberia-quedar' } });

        // Fallo deliberado, como pide la fase (ROLLBACK completo).
        throw new Error('Fallo deliberado para probar atomicidad');
      })
    ).rejects.toThrow('Fallo deliberado para probar atomicidad');

    expect(capturedEntryId).not.toBeNull();

    const storedEntry = await prisma.journalEntry.findUnique({ where: { id: capturedEntryId } });
    expect(storedEntry).toBeNull(); // el asiento NO debe quedar creado

    const storedLines = await prisma.journalEntryLine.findMany({ where: { journalEntryId: capturedEntryId } });
    expect(storedLines).toHaveLength(0); // ni sus líneas

    const storedAccount = await prisma.account.findUnique({ where: { id: account.id } });
    expect(storedAccount.description).not.toBe('no-deberia-quedar'); // el "documento" tampoco

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'JournalEntry', entityId: capturedEntryId, action: 'journal_entry.created' },
    });
    expect(audit).toBeNull(); // ninguna auditoría de éxito falsa
  });

  test('un asiento desbalanceado sigue rechazándose ANTES de tocar la base de datos, con o sin tx externa', async () => {
    const badData = entryData({ lines: [{ accountId: debitAccount.id, debit: 100, credit: 0 }] });
    await expect(ledgerService.postEntry(badData)).rejects.toThrow();
    await expect(prisma.$transaction((tx) => ledgerService.postEntry(badData, tx))).rejects.toThrow();
  });
});

describe('Unit of Work — withTransaction', () => {
  test('sin tx: abre una transacción real (los efectos son atómicos)', async () => {
    const account = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
    await expect(
      withTransaction(async (tx) => {
        await tx.account.update({ where: { id: account.id }, data: { description: 'via-uow-sin-tx' } });
        throw new Error('rollback esperado');
      })
    ).rejects.toThrow('rollback esperado');

    const stored = await prisma.account.findUnique({ where: { id: account.id } });
    expect(stored.description).not.toBe('via-uow-sin-tx');
  });

  test('con tx: reutiliza EXACTAMENTE el cliente recibido, no abre una transacción anidada', async () => {
    const received = [];
    const fakeTx = { marker: 'soy-la-transaccion-del-llamador' };
    const result = await withTransaction(async (tx) => {
      received.push(tx);
      return 'ok';
    }, fakeTx);

    expect(result).toBe('ok');
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(fakeTx); // mismo objeto — no se envolvió en otra transacción
  });
});
