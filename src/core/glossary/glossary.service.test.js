jest.mock('../../modules/fpa/services/kpis.service', () => ({
  getEbitda: jest.fn(),
  getBurnRateAndRunway: jest.fn(),
}));
jest.mock('../../modules/finance/services/finance-summary.service', () => ({
  getFinanceSummary: jest.fn(),
}));
jest.mock('../../modules/accounts-receivable/services/ar-invoices.service', () => ({
  getSalesTrend: jest.fn(),
}));

const kpisService = require('../../modules/fpa/services/kpis.service');
const financeSummaryService = require('../../modules/finance/services/finance-summary.service');
const arInvoicesService = require('../../modules/accounts-receivable/services/ar-invoices.service');
const glossaryService = require('./glossary.service');

describe('glossary.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('listTerms devuelve todos los términos con su bandera hasLiveValue', () => {
    const terms = glossaryService.listTerms();
    expect(terms.length).toBeGreaterThan(0);
    const ebitda = terms.find((t) => t.key === 'ebitda');
    expect(ebitda).toMatchObject({ label: 'EBITDA', hasLiveValue: true });
    const doubleEntry = terms.find((t) => t.key === 'double-entry');
    expect(doubleEntry).toMatchObject({ hasLiveValue: false });
  });

  test('getLiveValue rechaza un término que no existe', async () => {
    await expect(glossaryService.getLiveValue('c1', 'termino-inventado')).rejects.toMatchObject({
      code: 'GLOSSARY_TERM_NOT_FOUND',
    });
  });

  test('getLiveValue rechaza un término sin valor en vivo (ej. Partida doble)', async () => {
    await expect(glossaryService.getLiveValue('c1', 'double-entry')).rejects.toMatchObject({
      code: 'GLOSSARY_TERM_HAS_NO_LIVE_VALUE',
    });
  });

  test('getLiveValue de "ebitda" reutiliza kpisService.getEbitda, nunca recalcula', async () => {
    kpisService.getEbitda.mockResolvedValue({ ebitda: '1234.56' });
    const result = await glossaryService.getLiveValue('c1', 'ebitda');
    expect(kpisService.getEbitda).toHaveBeenCalledWith('c1', expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) }));
    expect(result.value).toBe('1234.56');
  });

  // Fase 5: los 3 casos de abajo pasan ahora por la capa de lectura
  // consolidada (modules/finance) en vez de importar cada uno su
  // propio servicio de Tesorería/AR/AP directo — ver la decisión
  // documentada en glossary.service.js.
  test('getLiveValue de "accounts-receivable" reutiliza el resumen financiero consolidado', async () => {
    financeSummaryService.getFinanceSummary.mockResolvedValue({ totalReceivable: '863.75' });
    const result = await glossaryService.getLiveValue('c1', 'accounts-receivable');
    expect(financeSummaryService.getFinanceSummary).toHaveBeenCalledWith('c1');
    expect(result.value).toBe('863.75');
  });

  test('getLiveValue de "liquidity-cushion" reutiliza el resumen financiero consolidado', async () => {
    financeSummaryService.getFinanceSummary.mockResolvedValue({ availableLiquidity: '5000.00', baseCurrency: 'USD' });
    const result = await glossaryService.getLiveValue('c1', 'liquidity-cushion');
    expect(result).toMatchObject({ value: '5000.00', currency: 'USD' });
  });

  test('getLiveValue de "accounts-payable" reutiliza el resumen financiero consolidado', async () => {
    financeSummaryService.getFinanceSummary.mockResolvedValue({ totalPayable: '110.00' });
    const result = await glossaryService.getLiveValue('c1', 'accounts-payable');
    expect(financeSummaryService.getFinanceSummary).toHaveBeenCalledWith('c1');
    expect(result.value).toBe('110.00');
  });

  // Fase 8 (sección 8, catálogo de KPIs): "Ventas de este mes" reutiliza
  // exactamente la misma función que ya alimenta el gráfico de ventas
  // del Panel principal — nunca suma facturas por su cuenta.
  test('getLiveValue de "sales-this-month" reutiliza ar-invoices.getSalesTrend con 1 solo mes', async () => {
    arInvoicesService.getSalesTrend.mockResolvedValue([{ month: '2026-09', totalSales: '4500.00', invoiceCount: 3 }]);
    const result = await glossaryService.getLiveValue('c1', 'sales-this-month');
    expect(arInvoicesService.getSalesTrend).toHaveBeenCalledWith('c1', { months: 1 });
    expect(result.value).toBe('4500.00');
  });

  test('listTerms devuelve la metadata de catálogo de KPI (fórmula/fuente/unidad) para los términos con valor en vivo', () => {
    const terms = glossaryService.listTerms();
    const ebitda = terms.find((t) => t.key === 'ebitda');
    expect(ebitda.formula).toEqual(expect.any(String));
    expect(ebitda.sourceRef).toBe('src/modules/fpa/services/kpis.service.js#getEbitda');
    expect(ebitda.unit).toBe('currency');
    expect(ebitda.periodicity).toBe('monthly');

    const doubleEntry = terms.find((t) => t.key === 'double-entry');
    expect(doubleEntry.sourceRef).toBeUndefined(); // término sin valor en vivo, sin fuente que trazar
  });
});
