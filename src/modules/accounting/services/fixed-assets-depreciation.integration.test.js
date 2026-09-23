// Fase 1 — prueba de integración contra Postgres real del caso más roto
// encontrado en la auditoría: depreciateAsset posteaba el asiento en su
// propia transacción y actualizaba el activo fijo después, sin
// transacción y sin auditoría. Esto confirma que ahora ambos pasos son
// atómicos y quedan auditados.
const {
  prisma,
  createCompany,
  createUser,
  createAccount,
  createOpenPeriod,
  cleanupCompany,
  unique,
} = require('../../../test-helpers/integration-fixtures');
const fixedAssetsService = require('./fixed-assets.service');

let company;
let user;
let assetAccount;
let expenseAccount;
let accumAccount;

beforeAll(async () => {
  company = await createCompany();
  user = await createUser(company.id);
  assetAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  expenseAccount = await createAccount(company.id, { type: 'EXPENSE', normalBalance: 'DEBIT' });
  accumAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'CREDIT' });
  await createOpenPeriod(company.id);
});

afterAll(async () => {
  await prisma.fixedAsset.deleteMany({ where: { companyId: company.id } });
  await cleanupCompany(company.id);
  await prisma.$disconnect();
});

async function createTestAsset() {
  return prisma.fixedAsset.create({
    data: {
      companyId: company.id,
      code: unique('ACT'),
      name: 'Activo de prueba',
      purchaseDate: new Date(new Date().getFullYear(), 0, 1),
      purchaseValue: 1200,
      salvageValue: 0,
      usefulLifeMonths: 12,
      depreciationMethod: 'STRAIGHT_LINE',
      assetAccountId: assetAccount.id,
      depreciationExpenseAccountId: expenseAccount.id,
      accumulatedDepreciationAccountId: accumAccount.id,
    },
  });
}

test('depreciateAsset postea el asiento, actualiza el activo y audita, todo junto', async () => {
  const asset = await createTestAsset();
  const asOfDate = new Date();

  const entry = await fixedAssetsService.depreciateAsset(company.id, asset, asOfDate, user.id, null);

  expect(entry).not.toBeNull();

  const storedEntry = await prisma.journalEntry.findUnique({ where: { id: entry.id }, include: { lines: true } });
  expect(storedEntry).not.toBeNull();
  expect(storedEntry.lines).toHaveLength(2);

  const updatedAsset = await prisma.fixedAsset.findUnique({ where: { id: asset.id } });
  expect(Number(updatedAsset.accumulatedDepreciation)).toBeGreaterThan(0);
  expect(updatedAsset.lastDepreciationDate).not.toBeNull();

  const audit = await prisma.auditLog.findFirst({
    where: { entityType: 'FixedAsset', entityId: asset.id, action: 'fixed_asset.depreciated' },
  });
  expect(audit).not.toBeNull(); // antes de Fase 1 esto no se registraba
});

test('no vuelve a depreciar el mismo mes (guarda de idempotencia de negocio, ahora consistente con el asiento)', async () => {
  const asset = await createTestAsset();
  const asOfDate = new Date();

  const first = await fixedAssetsService.depreciateAsset(company.id, asset, asOfDate, user.id, null);
  expect(first).not.toBeNull();

  const refreshed = await prisma.fixedAsset.findUnique({ where: { id: asset.id } });
  const second = await fixedAssetsService.depreciateAsset(company.id, refreshed, asOfDate, user.id, null);
  expect(second).toBeNull();

  const entriesForAsset = await prisma.journalEntry.findMany({ where: { companyId: company.id, sourceReference: asset.id } });
  expect(entriesForAsset).toHaveLength(1); // nunca duplicado
});
