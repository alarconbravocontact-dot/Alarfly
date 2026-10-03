const asyncHandler = require('../utils/asyncHandler');
const affiliateAuthService = require('./affiliate-auth.service');
const affiliatesService = require('./affiliates.service');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const result = await affiliateAuthService.registerAffiliate(name, email, password, phone);
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await affiliateAuthService.loginAffiliate(email, password);
  res.json(result);
});

const getLink = asyncHandler(async (req, res) => {
  const result = await affiliatesService.getLink(req.affiliateAuth.affiliateId);
  res.json(result);
});

const getSummary = asyncHandler(async (req, res) => {
  const result = await affiliatesService.getSummary(req.affiliateAuth.affiliateId);
  res.json(result);
});

const listReferrals = asyncHandler(async (req, res) => {
  const result = await affiliatesService.listReferrals(req.affiliateAuth.affiliateId);
  res.json(result);
});

const listCommissions = asyncHandler(async (req, res) => {
  const result = await affiliatesService.listCommissions(req.affiliateAuth.affiliateId, { status: req.query.status });
  res.json(result);
});

const getProfile = asyncHandler(async (req, res) => {
  const result = await affiliatesService.getProfile(req.affiliateAuth.affiliateId);
  res.json(result);
});

module.exports = { register, login, getLink, getSummary, listReferrals, listCommissions, getProfile };
