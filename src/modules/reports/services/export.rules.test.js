const { flattenIncomeStatement, flattenBalanceSheet, flattenCashFlow, flattenProfitability } = require('./export.rules');

describe('flattenIncomeStatement', () => {
  test('aplana las secciones y agrega las filas de totales', () => {
    const report = {
      sections: { INGRESO_OPERACIONAL: [{ code: '4135', name: 'Ventas', amount: '1000.00' }] },
      totalIncome: '1000.00',
      totalExpense: '400.00',
      netIncome: '600.00',
    };
    const flat = flattenIncomeStatement(report);
    expect(flat.title).toBe('Estado de Resultados');
    expect(flat.rows).toHaveLength(4); // 1 cuenta + 3 totales
    expect(flat.rows[0]).toEqual({ section: 'INGRESO_OPERACIONAL', code: '4135', name: 'Ventas', amount: '1000.00' });
    expect(flat.rows[3]).toEqual({ section: 'TOTAL', code: '', name: 'Utilidad neta', amount: '600.00' });
  });
});

describe('flattenBalanceSheet', () => {
  test('aplana las secciones y agrega las 4 filas de totales', () => {
    const report = {
      sections: { ACTIVO_CORRIENTE: [{ code: '1110', name: 'Bancos', balance: '500.00' }] },
      totalAssets: '500.00',
      totalLiabilities: '0.00',
      totalEquity: '0.00',
      netIncomeToDate: '500.00',
    };
    const flat = flattenBalanceSheet(report);
    expect(flat.rows).toHaveLength(5); // 1 cuenta + 4 totales
  });
});

describe('flattenCashFlow', () => {
  test('arma las 11 filas fijas del flujo de efectivo', () => {
    const report = {
      indirect: {
        operating: { netIncome: '100', depreciationAddback: '10', changeInOtherOperatingAssets: '0', changeInOtherOperatingLiabilities: '0', total: '110' },
        investing: { changeInFixedAssets: '-50', total: '-50' },
        financing: { changeInDebt: '0', changeInEquity: '0', total: '0' },
        netChangeInCash: '60',
      },
    };
    const flat = flattenCashFlow(report);
    expect(flat.rows).toHaveLength(11);
    expect(flat.rows[flat.rows.length - 1]).toEqual({ category: 'TOTAL', concept: 'Cambio neto en efectivo', amount: '60' });
  });
});

describe('flattenProfitability', () => {
  test('usa el título recibido y mapea las filas de rentabilidad', () => {
    const report = {
      rows: [
        {
          dimensionName: 'Producto A',
          directRevenue: '100.00',
          directCost: '20.00',
          contributionMargin: '80.00',
          indirectCostAllocated: '10.00',
          netMargin: '70.00',
          netMarginPercent: '70.00',
        },
      ],
    };
    const flat = flattenProfitability(report, 'Rentabilidad por Producto');
    expect(flat.title).toBe('Rentabilidad por Producto');
    expect(flat.rows[0].name).toBe('Producto A');
  });
});
