const asyncHandler = require('../utils/asyncHandler');
const importTemplatesService = require('./import-templates.service');

const listTemplates = asyncHandler(async (req, res) => {
  res.json(await importTemplatesService.listTemplates(req.auth.companyId, req.query.targetKey));
});

const createTemplate = asyncHandler(async (req, res) => {
  res.status(201).json(await importTemplatesService.createTemplate(req.auth.companyId, req.auth.userId, req.body));
});

const deleteTemplate = asyncHandler(async (req, res) => {
  await importTemplatesService.deleteTemplate(req.auth.companyId, req.auth.userId, req.auth.role, req.params.id);
  res.status(204).send();
});

module.exports = { listTemplates, createTemplate, deleteTemplate };
