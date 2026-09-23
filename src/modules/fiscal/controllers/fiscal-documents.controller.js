const asyncHandler = require('../../../core/utils/asyncHandler');
const documentsService = require('../services/fiscal-documents.service');

const upload = asyncHandler(async (req, res) => {
  const file = await documentsService.uploadDocument(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(file);
});

const search = asyncHandler(async (req, res) => {
  const files = await documentsService.searchDocuments(req.auth.companyId, req.query);
  res.json(files);
});

const getOne = asyncHandler(async (req, res) => {
  const file = await documentsService.getDocument(req.auth.companyId, req.params.id);
  res.json(file);
});

const remove = asyncHandler(async (req, res) => {
  await documentsService.deleteDocument(req.auth.companyId, req.params.id, req.auth.userId);
  res.status(204).send();
});

module.exports = { upload, search, getOne, remove };
