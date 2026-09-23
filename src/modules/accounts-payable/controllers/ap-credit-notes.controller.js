const asyncHandler = require('../../../core/utils/asyncHandler');
const apCreditNotesService = require('../services/ap-credit-notes.service');

const create = asyncHandler(async (req, res) => {
  const note = await apCreditNotesService.createCreditNote(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(note);
});

const getOne = asyncHandler(async (req, res) => {
  const note = await apCreditNotesService.getCreditNote(req.auth.companyId, req.params.id);
  res.json(note);
});

const list = asyncHandler(async (req, res) => {
  const notes = await apCreditNotesService.listCreditNotes(req.auth.companyId, req.query);
  res.json(notes);
});

module.exports = { create, getOne, list };
