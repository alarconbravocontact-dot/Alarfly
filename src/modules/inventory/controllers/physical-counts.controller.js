const asyncHandler = require('../../../core/utils/asyncHandler');
const physicalCountsService = require('../services/physical-counts.service');

const start = asyncHandler(async (req, res) => {
  const count = await physicalCountsService.startCount(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(count);
});

const submit = asyncHandler(async (req, res) => {
  const count = await physicalCountsService.submitCount(req.auth.companyId, req.auth.userId, req.params.id, req.body.lines);
  res.json(count);
});

const approve = asyncHandler(async (req, res) => {
  const count = await physicalCountsService.approveCount(req.auth.companyId, req.auth.userId, req.params.id);
  res.json(count);
});

const reject = asyncHandler(async (req, res) => {
  const count = await physicalCountsService.rejectCount(
    req.auth.companyId,
    req.auth.userId,
    req.params.id,
    req.body.rejectionReason
  );
  res.json(count);
});

const getOne = asyncHandler(async (req, res) => {
  const count = await physicalCountsService.getCount(req.auth.companyId, req.params.id);
  res.json(count);
});

const list = asyncHandler(async (req, res) => {
  const counts = await physicalCountsService.listCounts(req.auth.companyId, req.query);
  res.json(counts);
});

module.exports = { start, submit, approve, reject, getOne, list };
