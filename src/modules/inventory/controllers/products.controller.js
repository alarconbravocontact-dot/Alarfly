const asyncHandler = require('../../../core/utils/asyncHandler');
const productsService = require('../services/products.service');

const create = asyncHandler(async (req, res) => {
  const product = await productsService.createProduct(req.auth.companyId, req.body);
  res.status(201).json(product);
});

const update = asyncHandler(async (req, res) => {
  const product = await productsService.updateProduct(req.auth.companyId, req.params.id, req.body);
  res.json(product);
});

const addVariant = asyncHandler(async (req, res) => {
  const variant = await productsService.addVariant(req.auth.companyId, req.params.id, req.body);
  res.status(201).json(variant);
});

const list = asyncHandler(async (req, res) => {
  const products = await productsService.listProducts(req.auth.companyId, req.query);
  res.json(products);
});

const getOne = asyncHandler(async (req, res) => {
  const product = await productsService.getProduct(req.auth.companyId, req.params.id);
  res.json(product);
});

module.exports = { create, update, addVariant, list, getOne };
