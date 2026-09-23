const AppError = require('../../../../core/utils/AppError');
const { exportGenericCsv } = require('./generic-csv.exporter');

// Selector de estrategia (mismo patrón que los parsers de feeds
// bancarios): agregar un formato bancario/país específico (ACH, SEPA)
// es agregar una entrada aquí, sin tocar el resto del servicio de lotes.
const EXPORTERS = {
  GENERIC_CSV: exportGenericCsv,
};

function getExporter(format) {
  const exporter = EXPORTERS[format];
  if (!exporter) {
    throw new AppError(`No hay un exportador configurado para el formato "${format}".`, 400, 'UNKNOWN_EXPORT_FORMAT');
  }
  return exporter;
}

module.exports = { getExporter };
