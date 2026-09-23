const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
// Reutiliza el mismo registro de exportadores PDF/Excel que ya usa
// Reportes (genéricos: reciben {título, columnas, filas}, no saben
// nada de contabilidad ni de Análisis Avanzados) — no se duplica
// generación de PDF/Excel acá.
const { getExporter } = require('../../reports/services/exporters');
const { getCatalogEntry } = require('./analysis-catalog');

async function listReports(companyId, { analysisType, from, to, triggerSource } = {}) {
  return prisma.analysisReport.findMany({
    where: {
      companyId,
      analysisType: analysisType || undefined,
      triggerSource: triggerSource || undefined,
      createdAt: from || to ? { gte: from || undefined, lte: to || undefined } : undefined,
    },
    include: { triggeredByUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getReport(companyId, id) {
  const report = await prisma.analysisReport.findFirst({
    where: { id, companyId },
    include: { triggeredByUser: { select: { id: true, name: true } } },
  });
  if (!report) {
    throw new AppError('Ese reporte archivado no existe.', 404, 'ANALYSIS_REPORT_NOT_FOUND');
  }
  return report;
}

// Aplana un reporte archivado a la forma genérica {title, columns, rows}
// que ya entienden los exportadores de Reportes — mismo patrón que
// `reports/export.rules.js` usa para los reportes de Contabilidad.
function flattenAnalysisReport(report) {
  const catalogEntry = getCatalogEntry(report.analysisType);
  const rows = [
    { section: 'Resultado numérico', label: 'Valores calculados', value: JSON.stringify(report.numericResult) },
    { section: '¿Por qué dio este resultado?', label: '', value: report.causeExplanation },
    { section: 'Qué significa para tu negocio', label: '', value: report.simpleInterpretation },
    { section: 'Cómo se calculó', label: '', value: report.methodology },
  ];
  for (const recommendation of report.recommendations) {
    rows.push({ section: 'Sugerencia', label: recommendation.isPrimary ? 'Principal' : '', value: recommendation.text });
  }

  // El nombre de la hoja de Excel no admite / \ * ? : [ ] — se evita
  // por completo con guiones en vez de arriesgar un formato de fecha
  // que sí los use (ej. "18/7/2026" tumbaba la exportación a Excel).
  return {
    title: `${catalogEntry ? catalogEntry.label : report.analysisType} - ${new Date(report.createdAt).toISOString().slice(0, 10)}`,
    columns: [
      { key: 'section', label: 'Sección' },
      { key: 'label', label: '' },
      { key: 'value', label: 'Detalle' },
    ],
    rows,
  };
}

async function exportReport(companyId, id, format) {
  const report = await getReport(companyId, id);
  const { title, columns, rows } = flattenAnalysisReport(report);
  const exporter = getExporter(format);
  const buffer = await exporter.build(title, columns, rows);
  const catalogEntry = getCatalogEntry(report.analysisType);
  const filename = `${catalogEntry ? catalogEntry.label : report.analysisType}.${exporter.extension}`.replace(/\s+/g, '-').toLowerCase();
  return { buffer, contentType: exporter.contentType, filename };
}

module.exports = { listReports, getReport, exportReport };
