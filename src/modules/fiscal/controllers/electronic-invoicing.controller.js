const asyncHandler = require('../../../core/utils/asyncHandler');
const electronicInvoicingService = require('../services/electronic-invoicing.service');

const generate = asyncHandler(async (req, res) => {
  const document = await electronicInvoicingService.generateDocument(
    req.auth.companyId,
    req.auth.userId,
    req.params.transactionId,
    req.body.provider
  );
  res.status(201).json(document);
});

const cancel = asyncHandler(async (req, res) => {
  const document = await electronicInvoicingService.cancelDocument(req.auth.companyId, req.auth.userId, req.params.id, req.body.reason);
  res.json(document);
});

const getOne = asyncHandler(async (req, res) => {
  const document = await electronicInvoicingService.getDocument(req.auth.companyId, req.params.id);
  res.json(document);
});

const list = asyncHandler(async (req, res) => {
  const documents = await electronicInvoicingService.listDocuments(req.auth.companyId, req.query);
  res.json(documents);
});

module.exports = { generate, cancel, getOne, list };
