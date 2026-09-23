import { api } from './client';

export const fpaDimensionsApi = {
  tree: () => api.get('/fpa/dimensions/tree'),
  list: (query) => api.get('/fpa/dimensions', query),
  create: (data) => api.post('/fpa/dimensions', data),
  update: (id, data) => api.patch(`/fpa/dimensions/${id}`, data),
  remove: (id) => api.delete(`/fpa/dimensions/${id}`),
};

export const budgetsApi = {
  list: (query) => api.get('/fpa/budgets', query),
  getOne: (id) => api.get(`/fpa/budgets/${id}`),
  create: (data) => api.post('/fpa/budgets', data),
  submitForReview: (id) => api.post(`/fpa/budgets/${id}/submit-for-review`),
  sendBackToDraft: (id) => api.post(`/fpa/budgets/${id}/send-back-to-draft`),
  approve: (id) => api.post(`/fpa/budgets/${id}/approve`),
  upsertLine: (id, data) => api.post(`/fpa/budgets/${id}/lines`, data),
  deleteLine: (id, lineId) => api.delete(`/fpa/budgets/${id}/lines/${lineId}`),
};

export const budgetVarianceApi = {
  getSettings: () => api.get('/fpa/variance/settings'),
  updateSettings: (data) => api.patch('/fpa/variance/settings', data),
  getReport: (budgetId) => api.get(`/fpa/variance/budgets/${budgetId}/report`),
  justify: (lineId, comment) => api.post(`/fpa/variance/lines/${lineId}/justify`, { comment }),
  listJustifications: (lineId) => api.get(`/fpa/variance/lines/${lineId}/justifications`),
};

export const scenariosApi = {
  simulate: (data) => api.post('/fpa/scenarios/simulate', data),
  save: (data) => api.post('/fpa/scenarios', data),
  list: () => api.get('/fpa/scenarios'),
  getOne: (id) => api.get(`/fpa/scenarios/${id}`),
};

export const kpisApi = {
  ebitda: (from, to) => api.get('/fpa/kpis/ebitda', { from, to }),
  burnRateAndRunway: (from, to) => api.get('/fpa/kpis/burn-rate-runway', { from, to }),
  listDefinitions: () => api.get('/fpa/kpis/definitions'),
  createDefinition: (data) => api.post('/fpa/kpis/definitions', data),
  evaluate: (id, from, to) => api.get(`/fpa/kpis/definitions/${id}/evaluate`, { from, to }),
  compare: (id, fromA, toA, fromB, toB) => api.get(`/fpa/kpis/definitions/${id}/compare`, { fromA, toA, fromB, toB }),
};
