const asyncHandler = require('../../../core/utils/asyncHandler');
const exportService = require('../services/export.service');
const scheduledReportsService = require('../services/scheduled-reports.service');

const exportReport = asyncHandler(async (req, res) => {
  const { format, from, to, asOfDate } = req.query;
  const { buffer, contentType, filename } = await exportService.exportReport(req.auth.companyId, req.params.reportType, format, {
    from,
    to,
    asOfDate,
  });
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

const createScheduled = asyncHandler(async (req, res) => {
  const created = await scheduledReportsService.createScheduledReport(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(created);
});

const listScheduled = asyncHandler(async (req, res) => {
  const list = await scheduledReportsService.listScheduledReports(req.auth.companyId);
  res.json(list);
});

const updateScheduled = asyncHandler(async (req, res) => {
  const updated = await scheduledReportsService.updateScheduledReport(req.auth.companyId, req.params.id, req.body);
  res.json(updated);
});

const deleteScheduled = asyncHandler(async (req, res) => {
  await scheduledReportsService.deleteScheduledReport(req.auth.companyId, req.params.id);
  res.status(204).send();
});

const runScheduled = asyncHandler(async (req, res) => {
  const { buffer, contentType, filename } = await scheduledReportsService.runScheduledReport(req.auth.companyId, req.params.id);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

module.exports = { exportReport, createScheduled, listScheduled, updateScheduled, deleteScheduled, runScheduled };
