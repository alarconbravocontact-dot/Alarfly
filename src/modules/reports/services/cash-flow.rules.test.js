const { buildIndirectCashFlow } = require('./cash-flow.rules');

describe('buildIndirectCashFlow', () => {
  test('reconcilia exacto cuando solo hay utilidad y efectivo (caso trivial)', () => {
    const result = buildIndirectCashFlow({
      netIncomePeriod: 500,
      cashDebit: 500,
      cashCredit: 0,
      fixedAssetDebit: 0,
      fixedAssetCredit: 0,
      accumDepDebit: 0,
      accumDepCredit: 0,
      debtDebit: 0,
      debtCredit: 0,
      otherOpAssetDebit: 0,
      otherOpAssetCredit: 0,
      otherOpLiabDebit: 0,
      otherOpLiabCredit: 0,
      equityDebit: 0,
      equityCredit: 0,
    });
    expect(result.reconciles).toBe(true);
    expect(result.netChangeInCash).toBe('500.00');
  });

  test('reconcilia exacto con depreciación (contra-activo) — el mismo caso que expuso el bug del Balance General', () => {
    // Utilidad ya incluye el gasto de depreciación (100) restado; el
    // efectivo real no salió por eso, así que se debe sumar de vuelta.
    const result = buildIndirectCashFlow({
      netIncomePeriod: 400,
      cashDebit: 500, // el efectivo real sí subió 500 (la utilidad "de caja" real)
      cashCredit: 0,
      fixedAssetDebit: 0,
      fixedAssetCredit: 0,
      accumDepDebit: 0,
      accumDepCredit: 100,
      debtDebit: 0,
      debtCredit: 0,
      otherOpAssetDebit: 0,
      otherOpAssetCredit: 0,
      otherOpLiabDebit: 0,
      otherOpLiabCredit: 0,
      equityDebit: 0,
      equityCredit: 0,
    });
    expect(result.operating.depreciationAddback).toBe('100.00');
    expect(result.netChangeInCash).toBe('500.00');
    expect(result.reconciles).toBe(true);
  });

  test('reconcilia exacto con compra de activo fijo (inversión) pagada de contado', () => {
    const result = buildIndirectCashFlow({
      netIncomePeriod: 0,
      cashDebit: 0,
      cashCredit: 1200,
      fixedAssetDebit: 1200,
      fixedAssetCredit: 0,
      accumDepDebit: 0,
      accumDepCredit: 0,
      debtDebit: 0,
      debtCredit: 0,
      otherOpAssetDebit: 0,
      otherOpAssetCredit: 0,
      otherOpLiabDebit: 0,
      otherOpLiabCredit: 0,
      equityDebit: 0,
      equityCredit: 0,
    });
    expect(result.investing.total).toBe('-1200.00');
    expect(result.netChangeInCash).toBe('-1200.00');
    expect(result.reconciles).toBe(true);
  });

  test('reconcilia exacto con desembolso de préstamo (financiamiento)', () => {
    const result = buildIndirectCashFlow({
      netIncomePeriod: 0,
      cashDebit: 5000,
      cashCredit: 0,
      fixedAssetDebit: 0,
      fixedAssetCredit: 0,
      accumDepDebit: 0,
      accumDepCredit: 0,
      debtDebit: 0,
      debtCredit: 5000,
      otherOpAssetDebit: 0,
      otherOpAssetCredit: 0,
      otherOpLiabDebit: 0,
      otherOpLiabCredit: 0,
      equityDebit: 0,
      equityCredit: 0,
    });
    expect(result.financing.changeInDebt).toBe('5000.00');
    expect(result.netChangeInCash).toBe('5000.00');
    expect(result.reconciles).toBe(true);
  });

  test('reconcilia exacto en un escenario combinado (utilidad + depreciación + compra de activo + pago de cuota de deuda)', () => {
    // Utilidad de 400 (ya neta de 100 de depreciación); se compra un
    // activo de 300 de contado; se paga una cuota de deuda de 150 de
    // contado. Efectivo real: +400 +100 -300 -150 = 50.
    const result = buildIndirectCashFlow({
      netIncomePeriod: 400,
      cashDebit: 50, // efectivo real: +400 +100 -300 -150 = 50
      cashCredit: 0,
      fixedAssetDebit: 300,
      fixedAssetCredit: 0,
      accumDepDebit: 0,
      accumDepCredit: 100,
      debtDebit: 150,
      debtCredit: 0,
      otherOpAssetDebit: 0,
      otherOpAssetCredit: 0,
      otherOpLiabDebit: 0,
      otherOpLiabCredit: 0,
      equityDebit: 0,
      equityCredit: 0,
    });
    expect(result.netChangeInCash).toBe('50.00');
    expect(result.reconciles).toBe(true);
  });

  test('detecta un descuadre si el efectivo real (dato de Tesorería) no coincide con lo calculado', () => {
    const result = buildIndirectCashFlow({
      netIncomePeriod: 500,
      cashDebit: 400, // el efectivo real solo se movió 400, no 500
      cashCredit: 0,
      fixedAssetDebit: 0,
      fixedAssetCredit: 0,
      accumDepDebit: 0,
      accumDepCredit: 0,
      debtDebit: 0,
      debtCredit: 0,
      otherOpAssetDebit: 0,
      otherOpAssetCredit: 0,
      otherOpLiabDebit: 0,
      otherOpLiabCredit: 0,
      equityDebit: 0,
      equityCredit: 0,
    });
    expect(result.reconciles).toBe(false);
  });
});
