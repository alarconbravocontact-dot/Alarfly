import { api } from './client';

export const accountsApi = {
  tree: () => api.get('/accounting/accounts/tree'),
  list: (query) => api.get('/accounting/accounts', query),
  getOne: (id) => api.get(`/accounting/accounts/${id}`),
  create: (data) => api.post('/accounting/accounts', data),
  update: (id, data) => api.patch(`/accounting/accounts/${id}`, data),
  remove: (id) => api.delete(`/accounting/accounts/${id}`),
};

export const journalEntriesApi = {
  list: (query) => api.get('/accounting/journal-entries', query),
  getOne: (id) => api.get(`/accounting/journal-entries/${id}`),
  create: (data) => api.post('/accounting/journal-entries', data),
  submit: (id) => api.post(`/accounting/journal-entries/${id}/submit`),
  approve: (id) => api.post(`/accounting/journal-entries/${id}/approve`),
  reverse: (id, data) => api.post(`/accounting/journal-entries/${id}/reverse`, data),
  remove: (id) => api.delete(`/accounting/journal-entries/${id}`),
};

export const accountingReportsApi = {
  trialBalance: (asOfDate) => api.get('/accounting/reports/trial-balance', { asOfDate }),
  incomeStatement: (from, to) => api.get('/accounting/reports/income-statement', { from, to }),
  balanceSheet: (asOfDate) => api.get('/accounting/reports/balance-sheet', { asOfDate }),
  generalLedger: (accountId, from, to) => api.get(`/accounting/reports/general-ledger/${accountId}`, { from, to }),
};

export const periodsApi = {
  list: () => api.get('/accounting/periods'),
  create: (data) => api.post('/accounting/periods', data),
  close: (id) => api.post(`/accounting/periods/${id}/close`),
  reopen: (id, reason) => api.post(`/accounting/periods/${id}/reopen`, { reason }),
};
