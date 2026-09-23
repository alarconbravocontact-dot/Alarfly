const asyncHandler = require('../utils/asyncHandler');
const helpService = require('./help.service');

const getContext = asyncHandler(async (req, res) => {
  const context = await helpService.getContext(req.auth.companyId, req.auth.userId, req.query.moduleKey);
  res.json(context);
});

const askQuestion = asyncHandler(async (req, res) => {
  const result = await helpService.askQuestion(req.auth.companyId, req.auth.userId, req.body.moduleKey, req.body.questionText);
  res.status(201).json(result);
});

module.exports = { getContext, askQuestion };
