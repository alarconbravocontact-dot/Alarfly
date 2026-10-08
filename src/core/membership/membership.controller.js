const asyncHandler = require('../utils/asyncHandler');
const service = require('./membership.service');

const listPlans = asyncHandler(async (req, res) => {
  const plans = await service.listPlans();
  res.json(plans);
});

const getMyMembership = asyncHandler(async (req, res) => {
  const view = await service.getMembershipView(req.auth.companyId);
  res.json(view);
});

const listMyPayments = asyncHandler(async (req, res) => {
  const payments = await service.listOwnPayments(req.auth.companyId);
  res.json(payments);
});

// El precio/plan/moneda nunca vienen del body: `submitPayment` siempre
// los resuelve del lado del servidor a partir del plan real vigente.
const submitPayment = asyncHandler(async (req, res) => {
  const { method, referenceNote, idempotencyKey, proofFileName, proofMimeType, proofSizeBytes, proofContentBase64 } =
    req.body;
  const payment = await service.submitPayment(req.auth.companyId, req.auth.userId, {
    method,
    referenceNote,
    idempotencyKey,
    proof: {
      fileName: proofFileName,
      mimeType: proofMimeType,
      sizeBytes: proofSizeBytes,
      contentBase64: proofContentBase64,
    },
  });
  res.status(201).json(payment);
});

module.exports = { listPlans, getMyMembership, listMyPayments, submitPayment };
