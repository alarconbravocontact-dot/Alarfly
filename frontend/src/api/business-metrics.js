import { api } from './client';

export const businessMetricsApi = {
  list: (query) => api.get('/business-metrics', query),
  create: (data) => api.post('/business-metrics', data),
  update: (id, data) => api.patch(`/business-metrics/${id}`, data),
  listEntries: (id, query) => api.get(`/business-metrics/${id}/entries`, query),
  addEntry: (id, data) => api.post(`/business-metrics/${id}/entries`, data),
  deleteEntry: (id, entryId) => api.delete(`/business-metrics/${id}/entries/${entryId}`),
  getStats: (id, query) => api.get(`/business-metrics/${id}/stats`, query),
};
