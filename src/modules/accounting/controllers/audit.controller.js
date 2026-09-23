const asyncHandler = require('../../../core/utils/asyncHandler');
const auditService = require('../../../core/audit/audit.service');

const list = asyncHandler(async (req, res) => {
  const logs = await auditService.listForCompany(req.auth.companyId, req.query);
  res.json(logs);
});

const forEntity = asyncHandler(async (req, res) => {
  const logs = await auditService.listForEntity(req.auth.companyId, req.params.entityType, req.params.entityId);
  res.json(logs);
});

module.exports = { list, forEntity };
