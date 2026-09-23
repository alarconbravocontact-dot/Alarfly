const asyncHandler = require('../../../core/utils/asyncHandler');
const periodLockService = require('../../../core/period-lock/period-lock.service');

const create = asyncHandler(async (req, res) => {
  const period = await periodLockService.createPeriod({ companyId: req.auth.companyId, ...req.body });
  res.status(201).json(period);
});

const list = asyncHandler(async (req, res) => {
  const periods = await periodLockService.listPeriods(req.auth.companyId);
  res.json(periods);
});

const close = asyncHandler(async (req, res) => {
  const period = await periodLockService.closePeriod(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(period);
});

const reopen = asyncHandler(async (req, res) => {
  const period = await periodLockService.reopenPeriod(
    req.auth.companyId,
    req.params.id,
    req.auth.userId,
    req.body.reason
  );
  res.json(period);
});

module.exports = { create, list, close, reopen };
