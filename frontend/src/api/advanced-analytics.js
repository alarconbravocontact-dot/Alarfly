import { api, getToken, ApiError } from './client';
import { withProgress } from '../utils/progressBarBus';

export const analysisCatalogApi = {
  list: () => api.get('/advanced-analytics/catalog'),
};

export const analysisRunApi = {
  run: (analysisType, parameters) => api.post('/advanced-analytics/run', { analysisType, parameters }),
};

export const automationConfigApi = {
  list: () => api.get('/advanced-analytics/automation-config'),
  upsert: (analysisType, data) => api.patch(`/advanced-analytics/automation-config/${analysisType}`, data),
};

export const costClassificationApi = {
  list: () => api.get('/advanced-analytics/cost-classifications'),
  set: (accountId, costBehavior) => api.patch(`/advanced-analytics/cost-classifications/${accountId}`, { costBehavior }),
  remove: (accountId) => api.delete(`/advanced-analytics/cost-classifications/${accountId}`),
};

export const benchmarkApi = {
  list: () => api.get('/advanced-analytics/benchmark-values'),
  upsert: (metricKey, data) => api.patch(`/advanced-analytics/benchmark-values/${metricKey}`, data),
  remove: (metricKey) => api.delete(`/advanced-analytics/benchmark-values/${metricKey}`),
};

async function downloadAnalysisReport(id, format) {
  return withProgress(async () => {
    const response = await fetch(`/api/advanced-analytics/reports/${id}/export?format=${format}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(data?.error?.message || 'No se pudo exportar el reporte.', response.status, data?.error?.code);
    }
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `reporte.${format === 'excel' ? 'xlsx' : 'pdf'}`;
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

export const analysisReportsApi = {
  list: (params) => api.get('/advanced-analytics/reports', params),
  getOne: (id) => api.get(`/advanced-analytics/reports/${id}`),
  export: downloadAnalysisReport,
};
