const asyncHandler = require('../../../core/utils/asyncHandler');
const fiscalBooksService = require('../services/fiscal-books.service');

const salesBook = asyncHandler(async (req, res) => {
  const book = await fiscalBooksService.getSalesBook(req.auth.companyId, req.query);
  res.json(book);
});

const purchasesBook = asyncHandler(async (req, res) => {
  const book = await fiscalBooksService.getPurchasesBook(req.auth.companyId, req.query);
  res.json(book);
});

const withholdingsSummary = asyncHandler(async (req, res) => {
  const summary = await fiscalBooksService.getWithholdingsSummary(req.auth.companyId, req.query);
  res.json(summary);
});

const reconcilePeriod = asyncHandler(async (req, res) => {
  const result = await fiscalBooksService.reconcilePeriod(req.auth.companyId, req.params.periodId);
  res.json(result);
});

module.exports = { salesBook, purchasesBook, withholdingsSummary, reconcilePeriod };
