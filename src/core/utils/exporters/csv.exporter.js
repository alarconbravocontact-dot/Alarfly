// Exportador CSV genérico: misma forma de entrada que pdf.exporter.js/
// excel.exporter.js (título + columnas/filas ya aplanadas) — agregar
// un formato nuevo es un archivo nuevo en el registro, sin tocar el
// resto (mismo patrón adapter que ya usan los parsers de feeds
// bancarios y los proveedores de facturación electrónica).
function escapeCsvValue(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

async function build(title, columns, rows) {
  const header = columns.map((col) => escapeCsvValue(col.label)).join(',');
  const lines = rows.map((row) => columns.map((col) => escapeCsvValue(row[col.key])).join(','));
  const content = [header, ...lines].join('\r\n');
  // BOM UTF-8 para que Excel abra el CSV con tildes/ñ correctamente.
  return Buffer.from('﻿' + content, 'utf8');
}

module.exports = { build };
