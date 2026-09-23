const asyncHandler = require('../../../core/utils/asyncHandler');
const consolidationService = require('../services/consolidation.service');

const trialBalance = asyncHandler(async (req, res) => {
  const asOfDate = req.query.asOfDate || new Date();
  const report = await consolidationService.getConsolidatedTrialBalance(req.auth.companyId, asOfDate);
  res.json(report);
});

const setParentCompany = asyncHandler(async (req, res) => {
  const company = await consolidationService.setParentCompany(
    req.auth.companyId,
    req.body.parentCompanyId,
    req.auth.userId
  );
  res.json(company);
});

module.exports = { trialBalance, setParentCompany };
