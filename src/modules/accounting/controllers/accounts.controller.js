const asyncHandler = require('../../../core/utils/asyncHandler');
const accountsService = require('../services/accounts.service');
const templatesService = require('../services/account-templates.service');

const create = asyncHandler(async (req, res) => {
  const account = await accountsService.createAccount(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(account);
});

const update = asyncHandler(async (req, res) => {
  const account = await accountsService.updateAccount(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(account);
});

const remove = asyncHandler(async (req, res) => {
  await accountsService.deleteAccount(req.auth.companyId, req.params.id, req.auth.userId);
  res.status(204).send();
});

const list = asyncHandler(async (req, res) => {
  const accounts = await accountsService.listAccounts(req.auth.companyId, req.query);
  res.json(accounts);
});

const tree = asyncHandler(async (req, res) => {
  const accounts = await accountsService.getAccountTree(req.auth.companyId);
  res.json(accounts);
});

const getOne = asyncHandler(async (req, res) => {
  const account = await accountsService.getAccount(req.auth.companyId, req.params.id);
  res.json(account);
});

const listTemplates = asyncHandler(async (req, res) => {
  const templates = await templatesService.listTemplates();
  res.json(templates);
});

const applyTemplate = asyncHandler(async (req, res) => {
  const accounts = await templatesService.applyTemplate(req.auth.companyId, req.params.templateId, req.auth.userId);
  res.status(201).json(accounts);
});

module.exports = { create, update, remove, list, tree, getOne, listTemplates, applyTemplate };
