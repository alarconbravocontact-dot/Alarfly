import { api } from './client';
import { withProgress } from '../utils/progressBarBus';

export const customersApi = {
  list: (query) => api.get('/accounts-receivable/customers', query),
  getOne: (id) => api.get(`/accounts-receivable/customers/${id}`),
  create: (data) => api.post('/accounts-receivable/customers', data),
  update: (id, data) => api.patch(`/accounts-receivable/customers/${id}`, data),
  block: (id, reason) => api.post(`/accounts-receivable/customers/${id}/block`, { reason }),
  unblock: (id) => api.post(`/accounts-receivable/customers/${id}/unblock`),
  import: (rows) => withProgress(() => api.post('/accounts-receivable/customers/import', { rows })),
};

export const arInvoicesApi = {
  list: (query) => api.get('/accounts-receivable/invoices', query),
  getOne: (id) => api.get(`/accounts-receivable/invoices/${id}`),
  create: (data) => api.post('/accounts-receivable/invoices', data),
  salesTrend: (months) => api.get('/accounts-receivable/invoices/sales-trend', months ? { months } : undefined),
  recurrenceCheck: (id) => api.get(`/accounts-receivable/invoices/${id}/recurrence-check`),
  timeline: (id) => api.get(`/accounts-receivable/invoices/${id}/timeline`),
};

export const arRecurringTemplatesApi = {
  list: () => api.get('/accounts-receivable/recurring-templates'),
  create: (data) => api.post('/accounts-receivable/recurring-templates', data),
  deactivate: (id) => api.patch(`/accounts-receivable/recurring-templates/${id}/deactivate`),
};

export const arPaymentsApi = {
  list: (query) => api.get('/accounts-receivable/payments', query),
  getOne: (id) => api.get(`/accounts-receivable/payments/${id}`),
  create: (data) => api.post('/accounts-receivable/payments', data),
  applyAdvance: (id, applications) => api.post(`/accounts-receivable/payments/${id}/apply-advance`, { applications }),
};

export const arCollectionsApi = {
  scan: () => api.post('/accounts-receivable/collections/scan'),
};

export const arCreditNotesApi = {
  list: (query) => api.get('/accounts-receivable/credit-notes', query),
  getOne: (id) => api.get(`/accounts-receivable/credit-notes/${id}`),
  create: (data) => api.post('/accounts-receivable/credit-notes', data),
};

export const arExecutiveSummaryApi = {
  get: () => api.get('/accounts-receivable/executive-summary'),
};
