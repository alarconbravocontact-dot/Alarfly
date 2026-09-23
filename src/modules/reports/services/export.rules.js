// Funciones puras: aplanan el JSON que ya devuelven los otros
// servicios de Reportes (nunca recalculan nada) a la forma genérica
// {title, columns, rows} que entienden los exportadores de PDF/Excel.
function flattenIncomeStatement(report) {
  const rows = [];
  for (const [section, accounts] of Object.entries(report.sections)) {
    for (const account of accounts) {
      rows.push({ section, code: account.code, name: account.name, amount: account.amount });
    }
  }
  rows.push({ section: 'TOTAL', code: '', name: 'Ingresos totales', amount: report.totalIncome });
  rows.push({ section: 'TOTAL', code: '', name: 'Gastos totales', amount: report.totalExpense });
  rows.push({ section: 'TOTAL', code: '', name: 'Utilidad neta', amount: report.netIncome });

  return {
    title: 'Estado de Resultados',
    columns: [
      { key: 'section', label: 'Sección' },
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Cuenta' },
      { key: 'amount', label: 'Monto' },
    ],
    rows,
  };
}

function flattenBalanceSheet(report) {
  const rows = [];
  for (const [section, accounts] of Object.entries(report.sections)) {
    for (const account of accounts) {
      rows.push({ section, code: account.code, name: account.name, balance: account.balance });
    }
  }
  rows.push({ section: 'TOTAL', code: '', name: 'Total Activos', balance: report.totalAssets });
  rows.push({ section: 'TOTAL', code: '', name: 'Total Pasivos', balance: report.totalLiabilities });
  rows.push({ section: 'TOTAL', code: '', name: 'Total Patrimonio', balance: report.totalEquity });
  rows.push({ section: 'TOTAL', code: '', name: 'Utilidad Acumulada', balance: report.netIncomeToDate });

  return {
    title: 'Balance General',
    columns: [
      { key: 'section', label: 'Sección' },
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Cuenta' },
      { key: 'balance', label: 'Saldo' },
    ],
    rows,
  };
}

function flattenCashFlow(report) {
  const { indirect } = report;
  const rows = [
    { category: 'Operación', concept: 'Utilidad neta', amount: indirect.operating.netIncome },
    { category: 'Operación', concept: 'Depreciación (no efectivo)', amount: indirect.operating.depreciationAddback },
    { category: 'Operación', concept: 'Cambio en otros activos operativos', amount: indirect.operating.changeInOtherOperatingAssets },
    { category: 'Operación', concept: 'Cambio en otros pasivos operativos', amount: indirect.operating.changeInOtherOperatingLiabilities },
    { category: 'Operación', concept: 'Total Operación', amount: indirect.operating.total },
    { category: 'Inversión', concept: 'Cambio en activos fijos', amount: indirect.investing.changeInFixedAssets },
    { category: 'Inversión', concept: 'Total Inversión', amount: indirect.investing.total },
    { category: 'Financiamiento', concept: 'Cambio en deuda', amount: indirect.financing.changeInDebt },
    { category: 'Financiamiento', concept: 'Cambio en patrimonio', amount: indirect.financing.changeInEquity },
    { category: 'Financiamiento', concept: 'Total Financiamiento', amount: indirect.financing.total },
    { category: 'TOTAL', concept: 'Cambio neto en efectivo', amount: indirect.netChangeInCash },
  ];

  return {
    title: 'Flujo de Efectivo',
    columns: [
      { key: 'category', label: 'Categoría' },
      { key: 'concept', label: 'Concepto' },
      { key: 'amount', label: 'Monto' },
    ],
    rows,
  };
}

function flattenProfitability(report, title) {
  const rows = report.rows.map((row) => ({
    name: row.dimensionName,
    directRevenue: row.directRevenue,
    directCost: row.directCost,
    contributionMargin: row.contributionMargin,
    indirectCostAllocated: row.indirectCostAllocated,
    netMargin: row.netMargin,
    netMarginPercent: row.netMarginPercent,
  }));

  return {
    title,
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'directRevenue', label: 'Ingreso Directo' },
      { key: 'directCost', label: 'Costo Directo' },
      { key: 'contributionMargin', label: 'Margen de Contribución' },
      { key: 'indirectCostAllocated', label: 'Costo Indirecto Asignado' },
      { key: 'netMargin', label: 'Margen Neto' },
      { key: 'netMarginPercent', label: 'Margen Neto %' },
    ],
    rows,
  };
}

module.exports = { flattenIncomeStatement, flattenBalanceSheet, flattenCashFlow, flattenProfitability };
