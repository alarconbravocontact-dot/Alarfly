import { api, getToken, ApiError } from './client';
import { withProgress } from '../utils/progressBarBus';

export const financialStatementsApi = {
  balanceSheet: (asOfDate) => api.get('/reports/balance-sheet', { asOfDate }),
  incomeStatement: (from, to) => api.get('/reports/income-statement', { from, to }),
  drillDown: (accountId, from, to) => api.get(`/reports/drill-down/${accountId}`, { from, to }),
  transactionsByType: (type, from, to) => api.get('/reports/transactions-by-type', { type, from, to }),
  compareIncomeStatement: (fromA, toA, fromB, toB) => api.get('/reports/income-statement/compare', { fromA, toA, fromB, toB }),
  compareBalanceSheet: (asOfDateA, asOfDateB) => api.get('/reports/balance-sheet/compare', { asOfDateA, asOfDateB }),
};

export const cashFlowApi = {
  get: (from, to) => api.get('/reports/cash-flow', { from, to }),
};

export const profitabilityApi = {
  byProduct: (from, to) => api.get('/reports/profitability/products', { from, to }),
  byClient: (from, to) => api.get('/reports/profitability/clients', { from, to }),
};

export const agingApi = {
  receivables: (asOfDate) => api.get('/reports/aging/receivables', { asOfDate }),
  payables: (asOfDate) => api.get('/reports/aging/payables', { asOfDate }),
};

export const consolidationApi = {
  trialBalance: (asOfDate) => api.get('/reports/consolidation/trial-balance', { asOfDate }),
};

export const executiveDashboardApi = {
  get: (query) => api.get('/reports/dashboard', query),
  listWidgets: () => api.get('/reports/dashboard/widgets'),
  getPreferences: () => api.get('/reports/dashboard/preferences'),
  setPreference: (widgetKey, data) => api.patch(`/reports/dashboard/preferences/${widgetKey}`, data),
};

async function downloadBlob(path, { method = 'GET', fallbackFilename = 'reporte' } = {}) {
  return withProgress(async () => {
    const response = await fetch(`/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(data?.error?.message || 'No se pudo generar el archivo.', response.status, data?.error?.code);
    }
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : fallbackFilename;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}

function downloadReport(reportType, format, params = {}) {
  const query = new URLSearchParams({ format });
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return downloadBlob(`/reports/export/${reportType}?${query.toString()}`, {
    fallbackFilename: `${reportType}.${format === 'excel' ? 'xlsx' : 'pdf'}`,
  });
}

export const reportExportApi = {
  download: downloadReport,
  listScheduled: () => api.get('/reports/scheduled'),
  createScheduled: (data) => api.post('/reports/scheduled', data),
  updateScheduled: (id, data) => api.patch(`/reports/scheduled/${id}`, data),
  deleteScheduled: (id) => api.delete(`/reports/scheduled/${id}`),
  runScheduled: (id) => downloadBlob(`/reports/scheduled/${id}/run`, { method: 'POST', fallbackFilename: 'reporte-programado' }),
};
