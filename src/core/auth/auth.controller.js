const authService = require('./auth.service');
const asyncHandler = require('../utils/asyncHandler');

function requestContext(req) {
  return { deviceInfo: req.headers['user-agent'] || null, ipAddress: req.ip };
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, requestContext(req));
  res.json(result);
});

const verifyTwoFactor = asyncHandler(async (req, res) => {
  const { pendingToken, code } = req.body;
  const result = await authService.completeTwoFactorLogin(pendingToken, code, requestContext(req));
  res.json(result);
});

const acceptInvitation = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const result = await authService.acceptInvitation(token, password, requestContext(req));
  res.json(result);
});

const signup = asyncHandler(async (req, res) => {
  const { companyName, name, email, password } = req.body;
  const result = await authService.signup(companyName, name, email, password, requestContext(req));
  res.status(201).json(result);
});

module.exports = { login, verifyTwoFactor, acceptInvitation, signup };
