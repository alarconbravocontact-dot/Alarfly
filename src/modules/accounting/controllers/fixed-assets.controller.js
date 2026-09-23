const asyncHandler = require('../../../core/utils/asyncHandler');
const fixedAssetsService = require('../services/fixed-assets.service');

const create = asyncHandler(async (req, res) => {
  const asset = await fixedAssetsService.createFixedAsset(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(asset);
});

const list = asyncHandler(async (req, res) => {
  const assets = await fixedAssetsService.listFixedAssets(req.auth.companyId, req.query);
  res.json(assets);
});

const getOne = asyncHandler(async (req, res) => {
  const asset = await fixedAssetsService.getFixedAsset(req.auth.companyId, req.params.id);
  res.json(asset);
});

const dispose = asyncHandler(async (req, res) => {
  const asset = await fixedAssetsService.disposeAsset(
    req.auth.companyId,
    req.params.id,
    req.auth.userId,
    req.body.disposedAt
  );
  res.json(asset);
});

const runDepreciation = asyncHandler(async (req, res) => {
  const entries = await fixedAssetsService.runMonthlyDepreciation(
    req.auth.companyId,
    req.body.asOfDate,
    req.auth.userId,
    req.body.unitsByAssetId
  );
  res.status(201).json({ entriesPosted: entries.length, entries });
});

module.exports = { create, list, getOne, dispose, runDepreciation };
