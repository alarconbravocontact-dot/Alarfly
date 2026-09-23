import { api } from './client';

export const vendorsApi = {
  list: (query) => api.get('/accounts-payable/vendors', query),
  getOne: (id) => api.get(`/accounts-payable/vendors/${id}`),
  create: (data) => api.post('/accounts-payable/vendors', data),
  update: (id, data) => api.patch(`/accounts-payable/vendors/${id}`, data),
};

export const apBillsApi = {
  list: (query) => api.get('/accounts-payable/bills', query),
  getOne: (id) => api.get(`/accounts-payable/bills/${id}`),
  create: (data) => api.post('/accounts-payable/bills', data),
};

export const apPaymentsApi = {
  list: (query) => api.get('/accounts-payable/payments', query),
  getOne: (id) => api.get(`/accounts-payable/payments/${id}`),
  create: (data) => api.post('/accounts-payable/payments', data),
};

export const apCreditNotesApi = {
  list: (query) => api.get('/accounts-payable/credit-notes', query),
  getOne: (id) => api.get(`/accounts-payable/credit-notes/${id}`),
  create: (data) => api.post('/accounts-payable/credit-notes', data),
};
