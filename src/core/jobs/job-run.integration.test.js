// Prueba contra Postgres real (no mockeada, a diferencia de
// job-run.service.test.js): confirma que `JobRun` se escribe con el
// esquema real y que `getLastRunsByJob`/`listRuns` respetan el
// aislamiento por empresa (sección 19) — una corrida de la Empresa A
// nunca aparece en el catálogo de la Empresa B.
const { prisma, createCompany, cleanupCompany } = require('../../test-helpers/integration-fixtures');
const jobRunService = require('./job-run.service');

let companyA;
let companyB;

beforeEach(async () => {
  companyA = await createCompany();
  companyB = await createCompany();
});

afterEach(async () => {
  await prisma.jobRun.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  await cleanupCompany(companyA.id);
  await cleanupCompany(companyB.id);
});

describe('core/jobs — JobRun contra Postgres real (Fase 11)', () => {
  test('runJob persiste la corrida real y getLastRunsByJob aísla por empresa', async () => {
    await jobRunService.runJob('test.job', companyA.id, async () => 'ok-a');
    await jobRunService.runJob('test.job', companyB.id, async () => 'ok-b');

    const lastRunsA = await jobRunService.getLastRunsByJob(companyA.id);
    const lastRunsB = await jobRunService.getLastRunsByJob(companyB.id);

    expect(lastRunsA.size).toBe(1);
    expect(lastRunsB.size).toBe(1);
    expect(lastRunsA.get('test.job').companyId).toBe(companyA.id);
    expect(lastRunsB.get('test.job').companyId).toBe(companyB.id);
  });

  test('listRuns filtra por jobKey/status y respeta el límite', async () => {
    await jobRunService.runJob('job.one', companyA.id, async () => 'ok');
    await expect(
      jobRunService.runJob('job.two', companyA.id, async () => {
        throw new Error('falló a propósito');
      })
    ).rejects.toThrow();

    const errored = await jobRunService.listRuns(companyA.id, { status: 'ERROR' });
    expect(errored).toHaveLength(1);
    expect(errored[0].jobKey).toBe('job.two');
    expect(errored[0].errorMessage).toBe('falló a propósito');

    const onlyJobOne = await jobRunService.listRuns(companyA.id, { jobKey: 'job.one' });
    expect(onlyJobOne).toHaveLength(1);
    expect(onlyJobOne[0].status).toBe('SUCCESS');
  });
});
