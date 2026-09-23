const asyncHandler = require('../../../core/utils/asyncHandler');
const juntaService = require('../services/junta.service');

const create = asyncHandler(async (req, res) => {
  const message = await juntaService.createMessage(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(message);
});

const list = asyncHandler(async (req, res) => {
  const messages = await juntaService.listMessages(req.auth.companyId, req.auth);
  res.json(messages);
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await juntaService.countUnread(req.auth.companyId);
  res.json({ count });
});

const downloadFile = asyncHandler(async (req, res) => {
  const file = await juntaService.getMessageFile(req.auth.companyId, req.params.id);
  res.json(file);
});

const markAsRead = asyncHandler(async (req, res) => {
  const message = await juntaService.markAsRead(req.auth.companyId, req.auth.userId, req.params.id);
  res.json(message);
});

module.exports = { create, list, unreadCount, downloadFile, markAsRead };
