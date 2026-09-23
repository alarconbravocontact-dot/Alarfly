jest.mock('../database/prisma', () => ({
  apBill: { findMany: jest.fn() },
}));
jest.mock('../../modules/fpa/services/kpis.service', () => ({
  getEbitda: jest.fn(),
  getBurnRateAndRunway: jest.fn(),
}));
jest.mock('../../modules/treasury/services/treasury-accounts.service', () => ({
  getConsolidatedCashPosition: jest.fn(),
}));
jest.mock('../../modules/accounts-receivable/services/executive-summary.service', () => ({
  getExecutiveSummary: jest.fn(),
}));

const prisma = require('../database/prisma');
const kpisService = require('../../modules/fpa/services/kpis.service');
const treasuryAccountsService = require('../../modules/treasury/services/treasury-accounts.service');
const arExecutiveSummaryService = require('../../modules/accounts-receivable/services/executive-summary.service');
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

  test('getLiveValue de "accounts-receivable" reutiliza el resumen ejecutivo de AR', async () => {
    arExecutiveSummaryService.getExecutiveSummary.mockResolvedValue({ totalReceivable: { value: '863.75' } });
    const result = await glossaryService.getLiveValue('c1', 'accounts-receivable');
    expect(arExecutiveSummaryService.getExecutiveSummary).toHaveBeenCalledWith('c1');
    expect(result.value).toBe('863.75');
  });

  test('getLiveValue de "liquidity-cushion" reutiliza la posición de caja consolidada de Tesorería', async () => {
    treasuryAccountsService.getConsolidatedCashPosition.mockResolvedValue({ liquidityCushion: '5000.00', baseCurrency: 'USD' });
    const result = await glossaryService.getLiveValue('c1', 'liquidity-cushion');
    expect(result).toMatchObject({ value: '5000.00', currency: 'USD' });
  });

  test('getLiveValue de "accounts-payable" suma el saldo abierto de facturas de compra, aislado por empresa', async () => {
    prisma.apBill.findMany.mockResolvedValue([
      { totalAmount: '100.00', paidAmount: '40.00' },
      { totalAmount: '50.00', paidAmount: '0.00' },
    ]);
    const result = await glossaryService.getLiveValue('c1', 'accounts-payable');
    expect(prisma.apBill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', status: { in: ['OPEN', 'PARTIALLY_PAID'] } } })
    );
    expect(result.value).toBe('110.00');
  });
});
