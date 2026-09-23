const AppError = require('../AppError');
const pdfExporter = require('./pdf.exporter');
const excelExporter = require('./excel.exporter');
const csvExporter = require('./csv.exporter');

// Registro de formatos de exportación: agregar uno nuevo (ej. CSV) es
// una entrada nueva acá, mismo patrón adapter que ya se usó en los
// parsers de feeds bancarios y los proveedores de facturación
// electrónica. Vive en core porque ahora 2+ módulos lo necesitan
// (Reportes y el componente de tabla reutilizable) — regla 1 de la
// arquitectura maestra.
const EXPORTERS = {
  pdf: { build: pdfExporter.build, contentType: 'application/pdf', extension: 'pdf' },
  excel: {
    build: excelExporter.build,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  },
  csv: { build: csvExporter.build, contentType: 'text/csv; charset=utf-8', extension: 'csv' },
};

function getExporter(format) {
  const exporter = EXPORTERS[format];
  if (!exporter) {
    throw new AppError(`Formato de exportación no soportado: "${format}".`, 400, 'UNSUPPORTED_EXPORT_FORMAT');
  }
  return exporter;
}

module.exports = { getExporter };
