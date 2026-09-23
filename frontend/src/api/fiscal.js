import { api } from './client';

export const taxRatesApi = {
  listJurisdictions: () => api.get('/fiscal/tax/jurisdictions'),
  createJurisdiction: (data) => api.post('/fiscal/tax/jurisdictions', data),
  listRates: (query) => api.get('/fiscal/tax/rates', query),
  createRate: (data) => api.post('/fiscal/tax/rates', data),
  closeRate: (id, validTo) => api.post(`/fiscal/tax/rates/${id}/close`, { validTo }),
};

export const fiscalTransactionsApi = {
  list: (query) => api.get('/fiscal/transactions', query),
  getOne: (id) => api.get(`/fiscal/transactions/${id}`),
  create: (data) => api.post('/fiscal/transactions', data),
};

export const fiscalRiskRulesApi = {
  list: (query) => api.get('/fiscal/risk-rules', query),
  create: (data) => api.post('/fiscal/risk-rules', data),
  update: (id, data) => api.patch(`/fiscal/risk-rules/${id}`, data),
};

export const fiscalBooksApi = {
  salesBook: (from, to) => api.get('/fiscal/books/sales', { from, to }),
  purchasesBook: (from, to) => api.get('/fiscal/books/purchases', { from, to }),
  withholdingsSummary: (from, to) => api.get('/fiscal/books/withholdings', { from, to }),
  reconcilePeriod: (periodId) => api.get(`/fiscal/books/reconciliation/${periodId}`),
};

export const electronicInvoicingApi = {
  list: (query) => api.get('/fiscal/electronic-documents', query),
  getOne: (id) => api.get(`/fiscal/electronic-documents/${id}`),
  generate: (transactionId, provider) => api.post(`/fiscal/electronic-documents/transactions/${transactionId}/generate`, { provider }),
  cancel: (id, reason) => api.post(`/fiscal/electronic-documents/${id}/cancel`, { reason }),
};

export const fiscalObligationsApi = {
  list: (query) => api.get('/fiscal/obligations', query),
  create: (data) => api.post('/fiscal/obligations', data),
  update: (id, data) => api.patch(`/fiscal/obligations/${id}`, data),
  scan: () => api.post('/fiscal/obligations/scan'),
};

export const fiscalDocumentsApi = {
  search: (query) => api.get('/fiscal/documents', query),
  getOne: (id) => api.get(`/fiscal/documents/${id}`),
  upload: (data) => api.post('/fiscal/documents', data),
  remove: (id) => api.delete(`/fiscal/documents/${id}`),
};
