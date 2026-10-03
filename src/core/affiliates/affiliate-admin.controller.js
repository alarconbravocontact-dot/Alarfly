const asyncHandler = require('../utils/asyncHandler');
const adminService = require('./affiliate-admin.service');
const settingsService = require('./affiliate-settings.service');

const listAffiliates = asyncHandler(async (req, res) => {
  const result = await adminService.listAffiliates({ status: req.query.status });
  res.json(result);
});

const getAffiliate = asyncHandler(async (req, res) => {
  const result = await adminService.getAffiliateDetail(req.params.id);
  res.json(result);
});

const setAffiliateStatus = asyncHandler(async (req, res) => {
  const result = await adminService.setAffiliateStatus(req.params.id, req.body.status, req.auth.userId);
  res.json(result);
});

const listCommissions = asyncHandler(async (req, res) => {
  const result = await adminService.listAllCommissions({ status: req.query.status, affiliateId: req.query.affiliateId });
  res.json(result);
});

const transitionCommission = asyncHandler(async (req, res) => {
  const result = await adminService.transitionCommissionStatus(req.params.id, req.body.status, req.auth.userId, req.body.note);
  res.json(result);
});

const getSettings = asyncHandler(async (req, res) => {
  const result = await settingsService.getSettings();
  res.json(result);
});

const updateSettings = asyncHandler(async (req, res) => {
  const result = await settingsService.updateSettings(req.body);
  res.json(result);
});

const listAuditTrail = asyncHandler(async (req, res) => {
  const result = await adminService.listAuditTrail();
  res.json(result);
});

module.exports = {
  listAffiliates,
  getAffiliate,
  setAffiliateStatus,
  listCommissions,
  transitionCommission,
  getSettings,
  updateSettings,
  listAuditTrail,
};
