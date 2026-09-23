const asyncHandler = require('../../../core/utils/asyncHandler');
const taxRatesService = require('../services/tax-rates.service');

const createJurisdiction = asyncHandler(async (req, res) => {
  const jurisdiction = await taxRatesService.createJurisdiction(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(jurisdiction);
});

const listJurisdictions = asyncHandler(async (req, res) => {
  const jurisdictions = await taxRatesService.listJurisdictions(req.auth.companyId);
  res.json(jurisdictions);
});

const createTaxRate = asyncHandler(async (req, res) => {
  const rate = await taxRatesService.createTaxRate(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(rate);
});

const closeTaxRate = asyncHandler(async (req, res) => {
  const rate = await taxRatesService.closeTaxRate(req.auth.companyId, req.params.id, req.auth.userId, req.body.validTo);
  res.json(rate);
});

const listTaxRates = asyncHandler(async (req, res) => {
  const rates = await taxRatesService.listTaxRates(req.auth.companyId, req.query);
  res.json(rates);
});

const resolveTax = asyncHandler(async (req, res) => {
  const resolved = await taxRatesService.resolveApplicableTax(req.auth.companyId, req.query);
  res.json(resolved);
});

module.exports = { createJurisdiction, listJurisdictions, createTaxRate, closeTaxRate, listTaxRates, resolveTax };
