const { calculateNpv, calculateIrr, calculatePaybackPeriod, evaluateInvestment } = require('./investment-evaluation.rules');

describe('calculateNpv', () => {
  test('caso normal: descuenta cada flujo futuro a valor de hoy', () => {
    // -1000 + 500/1.1 + 500/1.1^2 + 500/1.1^3 ≈ 243.43
    const npv = calculateNpv({ initialInvestment: 1000, cashFlows: [500, 500, 500], discountRate: 0.1 });
    expect(npv.toDecimalPlaces(2).toNumber()).toBeCloseTo(243.43, 1);
  });

  test('con tasa de descuento 0, el VAN es simplemente la suma de flujos menos la inversión', () => {
    const npv = calculateNpv({ initialInvestment: 1000, cashFlows: [400, 400, 400], discountRate: 0 });
    expect(npv.toString()).toBe('200');
  });
});

describe('calculateIrr', () => {
  test('la TIR encontrada hace que el VAN a esa tasa sea prácticamente cero', () => {
    const irr = calculateIrr({ initialInvestment: 1000, cashFlows: [500, 500, 500] });
    expect(irr).not.toBeNull();
    const npvAtIrr = calculateNpv({ initialInvestment: 1000, cashFlows: [500, 500, 500], discountRate: irr.toNumber() });
    expect(npvAtIrr.abs().toNumber()).toBeLessThan(0.01);
  });

  test('sin ningún flujo positivo, no existe una TIR solucionable en el rango buscado', () => {
    const irr = calculateIrr({ initialInvestment: 1000, cashFlows: [-100, -100, -100] });
    expect(irr).toBeNull();
  });
});

describe('calculatePaybackPeriod', () => {
  test('caso normal: recupera la inversión a mitad de un periodo', () => {
    // Remanente tras periodo 1: 600; tras periodo 2: 200; periodo 3
    // cubre 200 de 400 → fracción 0.5 → payback = 2.5 periodos.
    const payback = calculatePaybackPeriod({ initialInvestment: 1000, cashFlows: [400, 400, 400, 400] });
    expect(payback.toString()).toBe('2.5');
  });

  test('recupera exactamente al cierre de un periodo', () => {
    const payback = calculatePaybackPeriod({ initialInvestment: 1000, cashFlows: [500, 500] });
    expect(payback.toString()).toBe('2');
  });

  test('nunca se recupera con los flujos dados → null', () => {
    const payback = calculatePaybackPeriod({ initialInvestment: 1000, cashFlows: [100, 100] });
    expect(payback).toBeNull();
  });
});

describe('evaluateInvestment', () => {
  test('arma las 3 métricas juntas y marca la inversión como recomendable si el VAN es positivo', () => {
    const result = evaluateInvestment({ initialInvestment: 1000, cashFlows: [500, 500, 500], discountRate: 0.1 });
    expect(result.npv.greaterThan(0)).toBe(true);
    expect(result.isRecommended).toBe(true);
    expect(result.irr).not.toBeNull();
    expect(result.paybackPeriods).not.toBeNull();
  });

  test('rechaza evaluar sin ningún flujo de caja proyectado', () => {
    expect(() => evaluateInvestment({ initialInvestment: 1000, cashFlows: [], discountRate: 0.1 })).toThrow('al menos un flujo');
  });
});
