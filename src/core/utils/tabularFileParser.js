// Asistente de importación (drag-and-drop de CSV/Excel): parsea el
// archivo a una forma genérica {headers, rows} — no sabe nada de
// clientes, cuentas ni ningún otro dato de negocio, mismo criterio que
// los exportadores genéricos de core/utils/exporters. El archivo viaja
// como texto base64 dentro del body JSON (mismo patrón que ya usan los
// feeds bancarios de Tesorería), no multipart/form-data.
const ExcelJS = require('exceljs');
const AppError = require('./AppError');

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // se resuelve junto con el \n que le sigue (o solo, si el archivo usa \r como salto)
    } else if (char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellToString(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (value.text !== undefined) return String(value.text); // rich text / hyperlink
    if (value.result !== undefined) return String(value.result); // fórmula ya resuelta
    return '';
  }
  return String(value);
}

async function parseXlsxBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new AppError('El archivo de Excel no tiene ninguna hoja con datos.', 400, 'EMPTY_WORKBOOK');
  }
  const rows = [];
  sheet.eachRow((row) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell) => cells.push(cellToString(cell.value)));
    rows.push(cells);
  });
  return rows;
}

// Devuelve {headers: string[], rows: string[][]} — la primera fila no
// vacía se toma como encabezado, filas completamente vacías se ignoran.
async function parseTabularFile(filename, contentBase64) {
  const extension = (filename.split('.').pop() || '').toLowerCase();
  const buffer = Buffer.from(contentBase64, 'base64');

  let rawRows;
  if (extension === 'csv') {
    rawRows = parseCsvText(buffer.toString('utf-8'));
  } else if (extension === 'xlsx' || extension === 'xls') {
    rawRows = await parseXlsxBuffer(buffer);
  } else {
    throw new AppError('Formato de archivo no soportado. Usa un archivo CSV o Excel (.xlsx).', 400, 'UNSUPPORTED_FILE_FORMAT');
  }

  const rows = rawRows.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (rows.length === 0) {
    throw new AppError('El archivo no tiene ninguna fila con datos.', 400, 'EMPTY_FILE');
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => String(h ?? '').trim());
  return { headers, rows: dataRows.map((row) => headers.map((_, i) => String(row[i] ?? '').trim())) };
}

module.exports = { parseTabularFile, parseCsvText };
