jest.mock('../database/prisma', () => ({
  jobRun: { create: jest.fn(), findMany: jest.fn() },
}));

const prisma = require('../database/prisma');
const jobRunService = require('./job-run.service');

describe('core/jobs/job-run.service (Fase 11)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('runJob guarda una fila SUCCESS y devuelve el resultado de la función cuando no falla', async () => {
    prisma.jobRun.create.mockResolvedValue({});
    const result = await jobRunService.runJob('test.job', 'company-1', async () => 'ok');

    expect(result).toBe('ok');
    expect(prisma.jobRun.create).toHaveBeenCalledTimes(1);
    const data = prisma.jobRun.create.mock.calls[0][0].data;
    expect(data.jobKey).toBe('test.job');
    expect(data.companyId).toBe('company-1');
    expect(data.status).toBe('SUCCESS');
    expect(data.errorMessage).toBeUndefined();
    expect(typeof data.durationMs).toBe('number');
  });

  test('runJob guarda una fila ERROR con el mensaje y vuelve a lanzar el error original', async () => {
    prisma.jobRun.create.mockResolvedValue({});
    const boom = new Error('algo salió mal');

    await expect(
      jobRunService.runJob('test.job', 'company-1', async () => {
        throw boom;
      })
    ).rejects.toThrow('algo salió mal');

    const data = prisma.jobRun.create.mock.calls[0][0].data;
    expect(data.status).toBe('ERROR');
    expect(data.errorMessage).toBe('algo salió mal');
  });

  test('getLastRunsByJob solo se queda con la corrida más reciente de cada jobKey', async () => {
    prisma.jobRun.findMany.mockResolvedValue([
      { jobKey: 'a', startedAt: new Date('2026-01-02') },
      { jobKey: 'a', startedAt: new Date('2026-01-01') },
      { jobKey: 'b', startedAt: new Date('2026-01-03') },
    ]);
    const result = await jobRunService.getLastRunsByJob('company-1');
    expect(prisma.jobRun.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      orderBy: { startedAt: 'desc' },
    });
    expect(result.get('a').startedAt).toEqual(new Date('2026-01-02'));
    expect(result.get('b').startedAt).toEqual(new Date('2026-01-03'));
    expect(result.size).toBe(2);
  });

  test('listRuns aplica el tope máximo de 500 aunque se pida un límite mayor', async () => {
    prisma.jobRun.findMany.mockResolvedValue([]);
    await jobRunService.listRuns('company-1', { limit: 10000 });
    expect(prisma.jobRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    );
  });
});
