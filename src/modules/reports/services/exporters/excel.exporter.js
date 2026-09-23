const ExcelJS = require('exceljs');

// Genera un Excel tabular genérico, misma forma de entrada que el
// exportador de PDF (título + columnas/filas ya aplanadas).
async function build(title, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.substring(0, 31)); // Excel limita el nombre de hoja a 31 caracteres

  sheet.columns = columns.map((col) => ({ header: col.label, key: col.key, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row);
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = { build };
