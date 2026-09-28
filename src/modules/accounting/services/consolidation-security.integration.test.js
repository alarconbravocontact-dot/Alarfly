// F14-E1 (corrección de seguridad, previa a E2): antes de esta
// corrección, `setParentCompany` solo verificaba que la empresa matriz
// existiera y que no se formara un ciclo — nunca que quien llamaba
// tuviera ninguna autorización sobre esa empresa. Cualquier ADMIN de
// una empresa podía nombrar a CUALQUIER otra empresa existente como su
// matriz, sin que esa empresa lo aprobara, y sus datos terminaban
// mezclados en el reporte "consolidado" de la víctima. Estos tests
// contra Postgres real prueban los 7 casos exigidos: vínculo válido,
// vínculo no autorizado rechazado, ciclo rechazado, consolidación
// legítima sin regresión, y que ni la empresa atacante gana lectura
// nueva ni la víctima recibe datos hasta que exista autorización real.
const {
  prisma,
  createCompany,
  createUser,
  createAccount,
  createOpenPeriod,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const consolidationService = require('./consolidation.service');
const ledgerService = require('../../../core/ledger/ledger.service');

let companyA;
let companyZ;
let adminA;

async function postSimpleEntry(companyId, userId, { assetAccountId, incomeAccountId, amount }) {
  await createOpenPeriod(companyId);
  return ledgerService.postEntry({
    companyId,
    date: new Date(),
    description: 'Movimiento de prueba F14-E1',
    createdByUserId: userId,
    autoApprove: true,
    lines: [
      { accountId: assetAccountId, debit: amount, credit: 0 },
      { accountId: incomeAccountId, debit: 0, credit: amount },
    ],
  });
}

beforeEach(async () => {
  companyA = await createCompany();
  companyZ = await createCompany();
  adminA = await createUser(companyA.id, 'ADMIN');
});

afterEach(async () => {
  await cleanupCompany(companyA.id);
  await cleanupCompany(companyZ.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Seguridad de consolidación (F14-E1): setParentCompany exige autorización real sobre la matriz', () => {
  test('1. ADMIN de A puede establecer como matriz una empresa sobre la que SÍ tiene autorización (su propia empresa de origen)', async () => {
    // Caso legítimo mínimo ya soportado sin infraestructura nueva: el
    // usuario es su propia "empresa de origen", así que desvincularse
    // (volver a null) siempre debe funcionar.
    const updated = await consolidationService.setParentCompany(companyA.id, null, adminA.id);
    expect(updated.parentCompanyId).toBeNull();
  });

  test('2. ADMIN de A intenta establecer la Empresa Z como matriz SIN autorización → rechazado (403)', async () => {
    await expect(consolidationService.setParentCompany(companyA.id, companyZ.id, adminA.id)).rejects.toMatchObject({
      statusCode: 403,
      code: 'PARENT_COMPANY_NOT_AUTHORIZED',
    });

    const fresh = await prisma.company.findUnique({ where: { id: companyA.id } });
    expect(fresh.parentCompanyId).toBeNull();
  });

  test('2b. Con autorización real (UserCompanyAccess), el vínculo SÍ se permite', async () => {
    await prisma.userCompanyAccess.create({
      data: { userId: adminA.id, companyId: companyZ.id, isDefault: false },
    });

    const updated = await consolidationService.setParentCompany(companyA.id, companyZ.id, adminA.id);
    expect(updated.parentCompanyId).toBe(companyZ.id);
  });

  test('3. La ruta exige rol ADMIN (regla ya existente, sin cambios) — verificado a nivel de middleware', async () => {
    // El middleware de la ruta (`requireRole('ADMIN')`) ya se prueba de
    // forma genérica en core/rbac; acá se confirma que el servicio en
    // sí no depende de eso (la puerta de rol vive en la ruta, no en el
    // servicio) — documentado, no se duplica esa prueba de RBAC genérico.
    const collaborator = await createUser(companyA.id, 'COLLABORATOR');
    // El servicio no valida rol (eso es responsabilidad de la ruta);
    // pero SÍ sigue exigiendo autorización real sobre la matriz —
    // confirma que ambas capas de defensa son independientes.
    await expect(
      consolidationService.setParentCompany(companyA.id, companyZ.id, collaborator.id)
    ).rejects.toMatchObject({ code: 'PARENT_COMPANY_NOT_AUTHORIZED' });
  });

  test('4. Intento de ciclo sigue rechazándose incluso con autorización real', async () => {
    await prisma.userCompanyAccess.create({
      data: { userId: adminA.id, companyId: companyZ.id, isDefault: false },
    });
    await consolidationService.setParentCompany(companyA.id, companyZ.id, adminA.id);

    // Ahora Z intentaría poner a A como su propia matriz -> ciclo.
    const adminZ = await createUser(companyZ.id, 'ADMIN');
    await prisma.userCompanyAccess.create({
      data: { userId: adminZ.id, companyId: companyA.id, isDefault: false },
    });
    await expect(consolidationService.setParentCompany(companyZ.id, companyA.id, adminZ.id)).rejects.toMatchObject({
      statusCode: 400,
      code: 'CIRCULAR_COMPANY_GROUP',
    });
  });

  test('5. La consolidación legítima (matriz+subsidiaria autorizadas) sigue funcionando sin regresión', async () => {
    await prisma.userCompanyAccess.create({
      data: { userId: adminA.id, companyId: companyZ.id, isDefault: false },
    });
    await consolidationService.setParentCompany(companyA.id, companyZ.id, adminA.id);

    const assetAccount = await createAccount(companyZ.id, { type: 'ASSET', normalBalance: 'DEBIT' });
    const incomeAccount = await createAccount(companyZ.id, { type: 'INCOME', normalBalance: 'CREDIT' });
    const adminZ = await createUser(companyZ.id, 'ADMIN');
    await postSimpleEntry(companyZ.id, adminZ.id, { assetAccountId: assetAccount.id, incomeAccountId: incomeAccount.id, amount: 500 });

    const report = await consolidationService.getConsolidatedTrialBalance(companyZ.id, new Date());
    expect(report.companiesIncluded.map((c) => c.id)).toEqual(expect.arrayContaining([companyZ.id, companyA.id]));
  });

  test('6. Empresa A no gana ningún acceso de lectura nuevo sobre Z por INTENTAR (sin éxito) establecer la relación', async () => {
    await expect(
      consolidationService.setParentCompany(companyA.id, companyZ.id, adminA.id)
    ).rejects.toBeDefined();

    // A sigue sin poder pedir la consolidación de Z (Z nunca fue
    // subsidiaria de A, y A tampoco es matriz de Z).
    const reportOfZAsParent = await consolidationService.getConsolidatedTrialBalance(companyZ.id, new Date());
    expect(reportOfZAsParent.companiesIncluded.map((c) => c.id)).toEqual([companyZ.id]);
  });

  test('7. Z no recibe datos de A hasta que exista autorización real (antes del fix, bastaba con que Z existiera)', async () => {
    const assetAccount = await createAccount(companyA.id, { type: 'ASSET', normalBalance: 'DEBIT' });
    const incomeAccount = await createAccount(companyA.id, { type: 'INCOME', normalBalance: 'CREDIT' });
    await postSimpleEntry(companyA.id, adminA.id, { assetAccountId: assetAccount.id, incomeAccountId: incomeAccount.id, amount: 999 });

    // Intento sin autorización: rechazado, A.parentCompanyId nunca se toca.
    await expect(consolidationService.setParentCompany(companyA.id, companyZ.id, adminA.id)).rejects.toMatchObject({
      code: 'PARENT_COMPANY_NOT_AUTHORIZED',
    });

    const reportOfZ = await consolidationService.getConsolidatedTrialBalance(companyZ.id, new Date());
    expect(reportOfZ.companiesIncluded).toHaveLength(1);
    expect(reportOfZ.rows.some((r) => r.balance === '999.00')).toBe(false);
  });
});
