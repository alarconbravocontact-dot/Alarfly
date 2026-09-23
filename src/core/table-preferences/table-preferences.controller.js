const asyncHandler = require('../utils/asyncHandler');
const tablePreferencesService = require('./table-preferences.service');
const tableExportService = require('./table-export.service');

const getPreferences = asyncHandler(async (req, res) => {
  res.json(await tablePreferencesService.getPreferences(req.auth.userId, req.params.tableKey));
});

const savePreferences = asyncHandler(async (req, res) => {
  res.json(
    await tablePreferencesService.savePreferences(req.auth.companyId, req.auth.userId, req.params.tableKey, req.body.columns)
  );
});

const resetPreferences = asyncHandler(async (req, res) => {
  await tablePreferencesService.resetPreferences(req.auth.userId, req.params.tableKey);
  res.status(204).send();
});

// Nombre de archivo seguro para el encabezado Content-Disposition: el
// título en sí (con acentos/espacios) sigue viajando tal cual dentro
// del Excel (nombre de la hoja), pero el nombre de archivo se limita a
// caracteres simples para no romper el encabezado HTTP.
function safeFilenameFrom(title) {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .toLowerCase();
}

const exportTable = asyncHandler(async (req, res) => {
  const { title, columns, rows, format } = req.body;
  const { buffer, contentType, filename } = await tableExportService.exportTable(title, columns, rows, format);
  const extension = filename.split('.').pop();
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilenameFrom(title)}.${extension}"`);
  res.send(buffer);
});

module.exports = { getPreferences, savePreferences, resetPreferences, exportTable };
