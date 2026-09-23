const asyncHandler = require('../../../core/utils/asyncHandler');
const categoriesService = require('../services/product-categories.service');

const create = asyncHandler(async (req, res) => {
  const category = await categoriesService.createCategory(req.auth.companyId, req.body, req.auth.userId);
  res.status(201).json(category);
});

const update = asyncHandler(async (req, res) => {
  const category = await categoriesService.updateCategory(req.auth.companyId, req.params.id, req.body, req.auth.userId);
  res.json(category);
});

const list = asyncHandler(async (req, res) => {
  const categories = await categoriesService.listCategories(req.auth.companyId, req.query);
  res.json(categories);
});

const getOne = asyncHandler(async (req, res) => {
  const category = await categoriesService.getCategory(req.auth.companyId, req.params.id);
  res.json(category);
});

module.exports = { create, update, list, getOne };
