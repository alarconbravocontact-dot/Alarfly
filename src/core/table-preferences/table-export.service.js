// Exportación rápida (PDF/Excel/CSV) del componente de tabla
// reutilizable (DataTable.jsx): a diferencia de los reportes de
// Reportes, acá los datos ya están cargados y filtrados en el
// navegador (esta tabla puede tener un FilterBuilder aplicado encima)
// — el frontend manda las filas ya aplanadas con las columnas
// visibles, en el orden que el usuario eligió, y este servicio solo
// arma el archivo en el formato pedido. Nunca recalcula ni vuelve a
// consultar nada.
const { getExporter } = require('../utils/exporters');

async function exportTable(title, columns, rows, format = 'excel') {
  const exporter = getExporter(format);
  const buffer = await exporter.build(title, columns, rows);
  return { buffer, contentType: exporter.contentType, filename: `${title}.${exporter.extension}` };
}

module.exports = { exportTable };
