const asyncHandler = require('../utils/asyncHandler');
const glossaryService = require('./glossary.service');

const listTerms = asyncHandler(async (req, res) => {
  res.json(glossaryService.listTerms());
});

const getLiveValue = asyncHandler(async (req, res) => {
  res.json(await glossaryService.getLiveValue(req.auth.companyId, req.params.key));
});

module.exports = { listTerms, getLiveValue };
