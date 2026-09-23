const AppError = require('../../../../core/utils/AppError');

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((v) => v.trim());
}

// Espera un CSV con encabezado. Columnas por defecto: date, description,
// amount, reference, externalId — se pueden renombrar con columnMapping
// si el banco exporta con otros nombres de columna.
function parseCsv(fileContent, columnMapping = {}) {
  const map = {
    date: 'date',
    description: 'description',
    amount: 'amount',
    reference: 'reference',
    externalId: 'externalId',
    ...columnMapping,
  };

  const lines = fileContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const colIndex = (key) => headers.indexOf(map[key]);

  const dateIdx = colIndex('date');
  const descIdx = colIndex('description');
  const amountIdx = colIndex('amount');
  const referenceIdx = colIndex('reference');
  const externalIdIdx = colIndex('externalId');

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new AppError(
      'El CSV debe tener columnas de fecha, descripción y monto (date, description, amount).',
      400,
      'INVALID_CSV_FORMAT'
    );
  }

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return {
      date: new Date(values[dateIdx]),
      description: values[descIdx],
      amount: Number(values[amountIdx]),
      reference: referenceIdx !== -1 ? values[referenceIdx] || null : null,
      externalId: externalIdIdx !== -1 ? values[externalIdIdx] || null : null,
      rawPayload: Object.fromEntries(headers.map((h, i) => [h, values[i]])),
    };
  });
}

module.exports = { parseCsv };
