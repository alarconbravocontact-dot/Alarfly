// F14-E8: antes de este fix, `getConsolidatedTrialBalance` sumaba
// `row.balance` de cada empresa del grupo sin mirar `Company.baseCurrency`
// en absoluto — una subsidiaria en una moneda distinta a la de la
// matriz mezclaba unidades distintas en el mismo total, sin ningún
// aviso. Estos tests contra Postgres real prueban: conversión correcta
// con tasa registrada, exclusión honesta (nunca una tasa inventada)
// cuando no hay tasa, y que el caso ya cubierto de mismas monedas
// sigue funcionando exactamente igual (sin regresión de F14-E1/E3).
const {
  prisma,
  createCompany,
  createUser,
  createAccount,
  createOpenPeriod,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const consolidationService = require('./consolidation.service');
const companyAccessService = require('../../access-levels/services/company-access.service');
const fxService = require('../../../core/fx/fx.service');
const ledgerService = require('../../../core/ledger/ledger.service');

let parent;
let subsidiary;
let parentAdmin;
let subsidiaryAdmin;

async function linkAsSubsidiary() {
  await companyAccessService.grantCompanyAccess(parent.id, parentAdmin.id, subsidiaryAdmin.email);
  await consolidationService.setParentCompany(subsidiary.id, parent.id, subsidiaryAdmin.id);
}

async function postEntryFor(companyId, userId, { assetAccountId, incomeAccountId, amount }) {
  await createOpenPeriod(companyId);
  return ledgerService.postEntry({
    companyId,
    date: new Date(),
    description: 'Movimiento de prueba F14-E8',
    createdByUserId: userId,
    autoApprove: true,
    lines: [
      { accountId: assetAccountId, debit: amount, credit: 0 },
      { accountId: incomeAccountId, debit: 0, credit: amount },
    ],
  });
}

beforeEach(async () => {
  parent = await createCompany();
  subsidiary = await prisma.company.create({ data: { name: 'Subsidiaria EUR F14-E8', baseCurrency: 'EUR' } });
  parentAdmin = await createUser(parent.id, 'ADMIN');
  subsidiaryAdmin = await createUser(subsidiary.id, 'ADMIN');
});

afterEach(async () => {
  await cleanupCompany(parent.id);
  await cleanupCompany(subsidiary.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Consolidación segura con monedas distintas (F14-E8)', () => {
  test('con tasa registrada, el saldo de la subsidiaria se convierte a la moneda de la matriz antes de sumarse', async () => {
    await linkAsSubsidiary();
    await fxService.recordRate({ companyId: parent.id, userId: parentAdmin.id, currency: 'EUR', rate: 1.1, date: new Date() });

    const asset = await createAccount(subsidiary.id, { type: 'ASSET', normalBalance: 'DEBIT', code: '1105' });
    const income = await createAccount(subsidiary.id, { type: 'INCOME', normalBalance: 'CREDIT', code: '9999-INC' });
    await postEntryFor(subsidiary.id, subsidiaryAdmin.id, { assetAccountId: asset.id, incomeAccountId: income.id, amount: 1000 });

    const report = await consolidationService.getConsolidatedTrialBalance(parent.id, new Date());

    expect(report.currenciesWithoutRate).toHaveLength(0);
    expect(report.companiesIncluded.map((c) => c.id)).toEqual(expect.arrayContaining([parent.id, subsidiary.id]));
    const assetRow = report.rows.find((r) => r.code === '1105');
    // 1000 EUR a 1 EUR = 1.10 USD -> 1100.00 en la moneda de la matriz
    expect(assetRow.balance).toBe('1100.00');
  });

  test('sin tasa registrada, la subsidiaria se excluye del total (nunca se inventa una tasa) y se reporta en currenciesWithoutRate', async () => {
    await linkAsSubsidiary();
    // Deliberadamente sin fxService.recordRate.

    const asset = await createAccount(subsidiary.id, { type: 'ASSET', normalBalance: 'DEBIT', code: '1106' });
    const income = await createAccount(subsidiary.id, { type: 'INCOME', normalBalance: 'CREDIT', code: '9998-INC' });
    await postEntryFor(subsidiary.id, subsidiaryAdmin.id, { assetAccountId: asset.id, incomeAccountId: income.id, amount: 500 });

    const report = await consolidationService.getConsolidatedTrialBalance(parent.id, new Date());

    expect(report.currenciesWithoutRate).toEqual([
      { companyId: subsidiary.id, companyName: subsidiary.name, currency: 'EUR' },
    ]);
    expect(report.companiesIncluded.map((c) => c.id)).toEqual([parent.id]);
    expect(report.rows.some((r) => r.code === '1106')).toBe(false);
  });

  test('sin regresión: dos empresas con la MISMA moneda siguen consolidando exactamente igual que antes (F14-E1)', async () => {
    const sameCurrencySub = await createCompany();
    const subAdmin2 = await createUser(sameCurrencySub.id, 'ADMIN');
    try {
      await companyAccessService.grantCompanyAccess(parent.id, parentAdmin.id, subAdmin2.email);
      await consolidationService.setParentCompany(sameCurrencySub.id, parent.id, subAdmin2.id);

      const asset = await createAccount(sameCurrencySub.id, { type: 'ASSET', normalBalance: 'DEBIT', code: '1107' });
      const income = await createAccount(sameCurrencySub.id, { type: 'INCOME', normalBalance: 'CREDIT', code: '9997-INC' });
      await postEntryFor(sameCurrencySub.id, subAdmin2.id, { assetAccountId: asset.id, incomeAccountId: income.id, amount: 250 });

      const report = await consolidationService.getConsolidatedTrialBalance(parent.id, new Date());
      expect(report.currenciesWithoutRate).toHaveLength(0);
      const assetRow = report.rows.find((r) => r.code === '1107');
      expect(assetRow.balance).toBe('250.00');
    } finally {
      await cleanupCompany(sameCurrencySub.id);
    }
  });
});
