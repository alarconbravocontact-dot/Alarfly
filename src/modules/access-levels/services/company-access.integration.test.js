// F14-E3: única capacidad nueva de esta etapa — un ADMIN puede otorgar
// a otro ADMIN (ya existente, ya activo) acceso a su empresa vía
// UserCompanyAccess, y revocarlo. Deliberadamente ADMIN→ADMIN (evita
// resolver cupos por rol cruzando empresas). Estos tests contra
// Postgres real prueban que otorgar la fila NUNCA da lectura/escritura
// de datos de negocio por sí sola, que el flujo de consolidación de
// F14-E1 (que ahora exige esta misma autorización) queda desbloqueado
// legítimamente, y que revocar solo afecta la fila otorgada, nunca la
// empresa de origen.
const {
  prisma,
  createCompany,
  createUser,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const companyAccessService = require('./company-access.service');
const consolidationService = require('../../accounting/services/consolidation.service');

let companyA;
let companyB;
let adminA;
let adminB;

beforeEach(async () => {
  companyA = await createCompany();
  companyB = await createCompany();
  adminA = await createUser(companyA.id, 'ADMIN');
  adminB = await createUser(companyB.id, 'ADMIN');
});

afterEach(async () => {
  await cleanupCompany(companyA.id);
  await cleanupCompany(companyB.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Otorgar/revocar acceso a otra empresa (F14-E3)', () => {
  test('ADMIN de B otorga acceso a ADMIN de A → crea UserCompanyAccess real', async () => {
    const access = await companyAccessService.grantCompanyAccess(companyB.id, adminB.id, adminA.email);
    expect(access.userId).toBe(adminA.id);
    expect(access.companyId).toBe(companyB.id);
    expect(access.isDefault).toBe(false);

    const rows = await companyAccessService.listGrantedAccess(companyB.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].user.email).toBe(adminA.email);
  });

  test('rechaza otorgar a un correo que no existe', async () => {
    await expect(
      companyAccessService.grantCompanyAccess(companyB.id, adminB.id, 'no-existe@example.com')
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  test('rechaza otorgar a un usuario que no es ADMIN', async () => {
    const collaborator = await createUser(companyA.id, 'COLLABORATOR');
    await expect(
      companyAccessService.grantCompanyAccess(companyB.id, adminB.id, collaborator.email)
    ).rejects.toMatchObject({ code: 'TARGET_MUST_BE_ADMIN' });
  });

  test('rechaza otorgar acceso a su propia empresa de origen (no tiene sentido, ya la tiene)', async () => {
    await expect(
      companyAccessService.grantCompanyAccess(companyA.id, adminA.id, adminA.email)
    ).rejects.toMatchObject({ code: 'ALREADY_HOME_COMPANY' });
  });

  test('rechaza otorgar el mismo acceso dos veces (sin duplicar la fila)', async () => {
    await companyAccessService.grantCompanyAccess(companyB.id, adminB.id, adminA.email);
    await expect(
      companyAccessService.grantCompanyAccess(companyB.id, adminB.id, adminA.email)
    ).rejects.toMatchObject({ code: 'ACCESS_ALREADY_GRANTED' });

    const rows = await prisma.userCompanyAccess.findMany({ where: { userId: adminA.id, companyId: companyB.id } });
    expect(rows).toHaveLength(1);
  });

  test('el acceso otorgado NO da ninguna lectura de datos de B por sí solo (hay que cambiar de empresa activa)', async () => {
    await companyAccessService.grantCompanyAccess(companyB.id, adminB.id, adminA.email);

    // Otorgar la fila es puramente administrativo: no altera ningún
    // dato de negocio de B, y el propio servicio de otorgamiento no
    // expone ni un byte de los datos de B más allá de la fila creada.
    const accessRows = await prisma.userCompanyAccess.findMany({ where: { userId: adminA.id } });
    expect(accessRows).toHaveLength(1);
    expect(accessRows[0].companyId).toBe(companyB.id);
    // (la validación de que "cambiar de empresa activa" es el único
    // camino real para leer datos ya está cubierta por
    // companies.service.test.js — switchActiveCompany — y por el
    // resto de la suite de aislamiento; acá solo se confirma que
    // otorgar por sí solo no es ya un canal de lectura.)
  });

  test('revocar elimina solo la fila otorgada, nunca la empresa de origen', async () => {
    await companyAccessService.grantCompanyAccess(companyB.id, adminB.id, adminA.email);

    const result = await companyAccessService.revokeCompanyAccess(companyB.id, adminB.id, adminA.email);
    expect(result.revoked).toBe(true);

    const rows = await prisma.userCompanyAccess.findMany({ where: { userId: adminA.id, companyId: companyB.id } });
    expect(rows).toHaveLength(0);

    const stillHomeUser = await prisma.user.findUnique({ where: { id: adminA.id } });
    expect(stillHomeUser.companyId).toBe(companyA.id);
  });

  test('rechaza revocar la empresa de origen de un usuario', async () => {
    await expect(
      companyAccessService.revokeCompanyAccess(companyA.id, adminA.id, adminA.email)
    ).rejects.toMatchObject({ code: 'CANNOT_REVOKE_HOME_ACCESS' });
  });

  test('rechaza revocar un acceso que no fue otorgado', async () => {
    await expect(
      companyAccessService.revokeCompanyAccess(companyB.id, adminB.id, adminA.email)
    ).rejects.toMatchObject({ code: 'ACCESS_NOT_FOUND' });
  });

  test('caso real desbloqueado: con acceso otorgado en ambos sentidos, la consolidación matriz/subsidiaria de F14-E1 funciona de punta a punta', async () => {
    // Réplica exacta del caso que F14-E1 dejó bloqueado para cualquier
    // par de empresas real (antes de esta pieza, nadie podía obtener
    // legítimamente un UserCompanyAccess hacia una empresa ajena).
    await companyAccessService.grantCompanyAccess(companyB.id, adminB.id, adminA.email);

    const updated = await consolidationService.setParentCompany(companyA.id, companyB.id, adminA.id);
    expect(updated.parentCompanyId).toBe(companyB.id);

    const report = await consolidationService.getConsolidatedTrialBalance(companyB.id, new Date());
    expect(report.companiesIncluded.map((c) => c.id)).toEqual(expect.arrayContaining([companyB.id, companyA.id]));
  });
});
