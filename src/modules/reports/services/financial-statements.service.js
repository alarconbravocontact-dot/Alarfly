// Capa de presentación sobre los reportes que ya existen en
// Contabilidad: este módulo NUNCA recalcula un estado financiero, solo
// envuelve reports.service (Módulo 1) para exponerlo bajo /reports con
// forma pensada para un frontend de reportes (comparativos, drill-down).
const reportsService = require('../../accounting/services/reports.service');

async function getBalanceSheet(companyId, asOfDate) {
  return reportsService.getBalanceSheet(companyId, asOfDate);
}

async function getIncomeStatement(companyId, { from, to }) {
  return reportsService.getIncomeStatement(companyId, { from, to });
}

// "Drill-down": dado el número de una cuenta en un reporte, devuelve
// los asientos que lo componen — es exactamente el libro mayor de esa
// cuenta, ya construido en Contabilidad.
async function drillDownAccount(companyId, accountId, { from, to }) {
  return reportsService.getGeneralLedger(companyId, accountId, { from, to });
}

// Drill-down de los gráficos del Panel principal: dado un tipo de
// cuenta (ej. "Egresos" del gráfico de ingresos/egresos) y un periodo,
// devuelve las transacciones reales que componen ese número — el mismo
// libro mayor de getGeneralLedger, generalizado a un tipo completo.
async function getTransactionsByType(companyId, type, { from, to }) {
  return reportsService.getTransactionsByType(companyId, type, { from, to });
}

async function compareIncomeStatements(companyId, rangeA, rangeB) {
  return reportsService.compareIncomeStatements(companyId, rangeA, rangeB);
}

async function compareBalanceSheets(companyId, asOfDateA, asOfDateB) {
  return reportsService.compareBalanceSheets(companyId, asOfDateA, asOfDateB);
}

module.exports = {
  getBalanceSheet,
  getIncomeStatement,
  drillDownAccount,
  getTransactionsByType,
  compareIncomeStatements,
  compareBalanceSheets,
};
