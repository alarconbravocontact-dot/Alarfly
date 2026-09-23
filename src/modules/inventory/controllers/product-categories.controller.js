const asyncHandler = require('../../../core/utils/asyncHandler');
const categoriesService = require('../services/product-categories.service');

const create = asyncHandler(async (req, res) => {
  const category = await categoriesService.createCategory(req.auth.companyId, req.body);
  res.status(201).json(category);
});

const list = asyncHandler(async (req, res) => {
  const categories = await categoriesService.listCategories(req.auth.companyId);
  res.json(categories);
});

const getOne = asyncHandler(async (req, res) => {
  const category = await categoriesService.getCategory(req.auth.companyId, req.params.id);
  res.json(category);
});

module.exports = { create, list, getOne };
