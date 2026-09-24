const asyncHandler = require('../utils/asyncHandler');
const auditService = require('./audit.service');

const list = asyncHandler(async (req, res) => {
  const { entityType, action, from, to, userId, limit } = req.query;
  const logs = await auditService.listForCompany(req.auth.companyId, {
    entityType,
    action,
    userId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json(logs);
});

const forEntity = asyncHandler(async (req, res) => {
  const logs = await auditService.listForEntity(req.auth.companyId, req.params.entityType, req.params.entityId);
  res.json(logs);
});

module.exports = { list, forEntity };
