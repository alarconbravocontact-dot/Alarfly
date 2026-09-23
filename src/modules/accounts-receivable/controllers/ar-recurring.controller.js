const asyncHandler = require('../../../core/utils/asyncHandler');
const arRecurringService = require('../services/ar-recurring.service');

const checkRecurrence = asyncHandler(async (req, res) => {
  const result = await arRecurringService.checkRecurrence(req.auth.companyId, req.params.id);
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  const template = await arRecurringService.createTemplate(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(template);
});

const list = asyncHandler(async (req, res) => {
  const templates = await arRecurringService.listTemplates(req.auth.companyId);
  res.json(templates);
});

const deactivate = asyncHandler(async (req, res) => {
  const template = await arRecurringService.deactivateTemplate(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(template);
});

module.exports = { checkRecurrence, create, list, deactivate };
