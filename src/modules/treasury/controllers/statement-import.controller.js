const asyncHandler = require('../../../core/utils/asyncHandler');
const statementImportService = require('../services/statement-import.service');

const importStatement = asyncHandler(async (req, res) => {
  const result = await statementImportService.importBankStatement(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(result);
});

const listImports = asyncHandler(async (req, res) => {
  const imports = await statementImportService.listImports(req.auth.companyId, req.query.treasuryAccountId);
  res.json(imports);
});

const listTransactions = asyncHandler(async (req, res) => {
  const transactions = await statementImportService.listBankTransactions(req.auth.companyId, req.query);
  res.json(transactions);
});

module.exports = { importStatement, listImports, listTransactions };
