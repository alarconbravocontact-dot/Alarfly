jest.mock('../../../core/database/prisma', () => ({
  analysisAutomationConfig: { findMany: jest.fn(), update: jest.fn() },
  analysisReport: { update: jest.fn() },
}));
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));
jest.mock('../../../core/alerts/alerts.service', () => ({ createAlertIfNotExists: jest.fn() }));
jest.mock('./analysis-engine.service', () => ({ runAnalysis: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const auditService = require('../../../core/audit/audit.service');
const alertsService = require('../../../core/alerts/alerts.service');
const analysisEngine = require('./analysis-engine.service');
const { runDueAutomations, flattenForCondition } = require('./automation-runner.service');

describe('flattenForCondition', () => {
  test('aplana un resultado anidado a notación "grupo.campo"', () => {
    const flat = flattenForCondition({ liquidity: { currentRatio: '0.80' }, breakEvenRevenue: '5000.00' });
    expect(flat).toEqual({ 'liquidity.currentRatio': '0.80', breakEvenRevenue: '5000.00' });
  });

  test('no revienta con un array dentro del resultado', () => {
    const flat = flattenForCondition({ rows: [{ a: 1 }], total: 10 });
    expect(flat.rows).toEqual([{ a: 1 }]);
    expect(flat.total).toBe(10);
  });
});

describe('runDueAutomations', () => {
  beforeEach(() => jest.clearAllMocks());

  test('no vuelve a correr (ni duplica reporte) un análisis DIARIO que ya corrió hoy', async () => {
    const today = new Date('2026-07-18T10:00:00Z');
    jest.useFakeTimers().setSystemTime(today);

    prisma.analysisAutomationConfig.findMany.mockResolvedValue([
      { id: 'cfg-1', analysisType: 'BREAK_EVEN', frequency: 'DAILY', lastRunAt: new Date('2026-07-18T06:00:00Z'), defaultParameters: {}, alertCondition: null },
    ]);

    const result = await runDueAutomations('company-1', 'admin-1');

    expect(analysisEngine.runAnalysis).not.toHaveBeenCalled();
    expect(prisma.analysisAutomationConfig.update).not.toHaveBeenCalled();
    expect(result).toEqual([]);
    jest.useRealTimers();
  });

  test('corre un análisis vencido, actualiza lastRunAt y audita la ejecución', async () => {
    prisma.analysisAutomationConfig.findMany.mockResolvedValue([
      { id: 'cfg-1', analysisType: 'BREAK_EVEN', frequency: 'DAILY', lastRunAt: null, defaultParameters: { from: '2026-01-01' }, alertCondition: null },
    ]);
    analysisEngine.runAnalysis.mockResolvedValue({ id: 'report-1', numericResult: { breakEvenRevenue: '5000.00' } });

    const result = await runDueAutomations('company-1', 'admin-1');

    expect(analysisEngine.runAnalysis).toHaveBeenCalledWith('company-1', 'BREAK_EVEN', { from: '2026-01-01' }, { triggerSource: 'AUTOMATIC', triggeredByUserId: null });
    expect(prisma.analysisAutomationConfig.update).toHaveBeenCalledWith({ where: { id: 'cfg-1' }, data: { lastRunAt: expect.any(Date) } });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'advanced_analysis.auto_run', entityId: 'report-1' }));
    expect(alertsService.createAlertIfNotExists).not.toHaveBeenCalled();
    expect(result).toEqual([{ analysisType: 'BREAK_EVEN', reportId: 'report-1', alertId: null }]);
  });

  test('dispara una alerta cuando el resultado cruza la condición configurada', async () => {
    prisma.analysisAutomationConfig.findMany.mockResolvedValue([
      {
        id: 'cfg-1',
        analysisType: 'BREAK_EVEN',
        frequency: 'DAILY',
        lastRunAt: null,
        defaultParameters: {},
        alertCondition: { field: 'breakEvenRevenue', op: 'gt', value: 4000 },
      },
    ]);
    analysisEngine.runAnalysis.mockResolvedValue({ id: 'report-1', numericResult: { breakEvenRevenue: '5000.00' } });
    alertsService.createAlertIfNotExists.mockResolvedValue({ id: 'alert-1' });

    const result = await runDueAutomations('company-1', 'admin-1');

    expect(alertsService.createAlertIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ADVANCED_ANALYSIS_ALERT', entityType: 'AnalysisReport', entityId: 'report-1' })
    );
    expect(prisma.analysisReport.update).toHaveBeenCalledWith({ where: { id: 'report-1' }, data: { generatedAlertId: 'alert-1' } });
    expect(result[0].alertId).toBe('alert-1');
  });

  test('no dispara alerta cuando el resultado NO cruza la condición configurada', async () => {
    prisma.analysisAutomationConfig.findMany.mockResolvedValue([
      {
        id: 'cfg-1',
        analysisType: 'BREAK_EVEN',
        frequency: 'DAILY',
        lastRunAt: null,
        defaultParameters: {},
        alertCondition: { field: 'breakEvenRevenue', op: 'gt', value: 999999 },
      },
    ]);
    analysisEngine.runAnalysis.mockResolvedValue({ id: 'report-1', numericResult: { breakEvenRevenue: '5000.00' } });

    await runDueAutomations('company-1', 'admin-1');

    expect(alertsService.createAlertIfNotExists).not.toHaveBeenCalled();
  });

  test('un análisis que falla no bloquea a los demás', async () => {
    prisma.analysisAutomationConfig.findMany.mockResolvedValue([
      { id: 'cfg-1', analysisType: 'BREAK_EVEN', frequency: 'DAILY', lastRunAt: null, defaultParameters: {}, alertCondition: null },
      { id: 'cfg-2', analysisType: 'DUPONT', frequency: 'DAILY', lastRunAt: null, defaultParameters: {}, alertCondition: null },
    ]);
    analysisEngine.runAnalysis.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ id: 'report-2', numericResult: { roe: '10' } });

    const result = await runDueAutomations('company-1', 'admin-1');

    expect(analysisEngine.runAnalysis).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ analysisType: 'DUPONT', reportId: 'report-2', alertId: null }]);
  });
});
