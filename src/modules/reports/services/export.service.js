// Exportación de reportes (punto 7). Nunca recalcula un reporte: pide
// el JSON al servicio de Reportes que ya lo calcula (los mismos de los
// puntos 1, 2 y 4), lo aplana con export.rules.js, y lo pasa al
// exportador del formato pedido (pdf/excel).
const AppError = require('../../../core/utils/AppError');
const { getExporter } = require('./exporters');
const financialStatementsService = require('./financial-statements.service');
const cashFlowService = require('./cash-flow.service');
const profitabilityService = require('./profitability.service');
const {
  flattenIncomeStatement,
  flattenBalanceSheet,
  flattenCashFlow,
  flattenProfitability,
} = require('./export.rules');

const REPORT_BUILDERS = {
  'income-statement': async (companyId, { from, to }) => {
    const report = await financialStatementsService.getIncomeStatement(companyId, { from, to });
    return flattenIncomeStatement(report);
  },
  'balance-sheet': async (companyId, { asOfDate }) => {
    const report = await financialStatementsService.getBalanceSheet(companyId, asOfDate);
    return flattenBalanceSheet(report);
  },
  'cash-flow': async (companyId, { from, to }) => {
    const report = await cashFlowService.getCashFlowStatement(companyId, { from, to });
    return flattenCashFlow(report);
  },
  'profitability-products': async (companyId, { from, to }) => {
    const report = await profitabilityService.getProductProfitability(companyId, { from, to });
    return flattenProfitability(report, 'Rentabilidad por Producto');
  },
  'profitability-clients': async (companyId, { from, to }) => {
    const report = await profitabilityService.getClientProfitability(companyId, { from, to });
    return flattenProfitability(report, 'Rentabilidad por Cliente');
  },
};

const REPORT_TYPES = Object.keys(REPORT_BUILDERS);

async function exportReport(companyId, reportType, format, params) {
  const builder = REPORT_BUILDERS[reportType];
  if (!builder) {
    throw new AppError(`Tipo de reporte no soportado para exportar: "${reportType}".`, 400, 'UNSUPPORTED_REPORT_TYPE');
  }

  const { title, columns, rows } = await builder(companyId, params);
  const exporter = getExporter(format);
  const buffer = await exporter.build(title, columns, rows);

  return { buffer, contentType: exporter.contentType, filename: `${reportType}.${exporter.extension}`, title };
}

module.exports = { exportReport, REPORT_TYPES };
