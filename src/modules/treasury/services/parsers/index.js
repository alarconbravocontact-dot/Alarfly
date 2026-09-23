const AppError = require('../../../../core/utils/AppError');
const { parseCsv } = require('./csv.parser');
const { parseOfx } = require('./ofx.parser');
const { parseMt940 } = require('./mt940.parser');

// Selector de estrategia (patrón adapter/strategy): agregar un origen
// nuevo — por ejemplo una conexión Open Banking / agregador en tiempo
// real — es agregar una entrada aquí que entregue el mismo formato de
// salida ({date, description, amount, reference, externalId,
// rawPayload}); el resto del servicio de importación no cambia.
const PARSERS = {
  CSV: parseCsv,
  OFX: parseOfx,
  MT940: parseMt940,
};

function getParser(source) {
  const parser = PARSERS[source];
  if (!parser) {
    throw new AppError(`No hay un lector configurado para el formato "${source}".`, 400, 'UNKNOWN_STATEMENT_SOURCE');
  }
  return parser;
}

module.exports = { getParser };
