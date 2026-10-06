import { api } from './client';

export const employeesApi = {
  list: (query) => api.get('/personal/employees', query),
  getOne: (id) => api.get(`/personal/employees/${id}`),
  getFicha: (id) => api.get(`/personal/employees/${id}/ficha`),
  create: (data) => api.post('/personal/employees', data),
  update: (id, data) => api.patch(`/personal/employees/${id}`, data),
};

export const payrollApi = {
  list: (query) => api.get('/personal/payroll', query),
  getOne: (id) => api.get(`/personal/payroll/${id}`),
  create: (data) => api.post('/personal/payroll', data),
  calculate: (id, employeeIds) => api.post(`/personal/payroll/${id}/calculate`, { employeeIds }),
  updateItem: (id, itemId, data) => api.patch(`/personal/payroll/${id}/items/${itemId}`, data),
  review: (id) => api.post(`/personal/payroll/${id}/review`),
  sendBackToDraft: (id) => api.post(`/personal/payroll/${id}/send-back-to-draft`),
  sendBackToCalculated: (id) => api.post(`/personal/payroll/${id}/send-back-to-calculated`),
  approve: (id) => api.post(`/personal/payroll/${id}/approve`),
  pay: (id, treasuryAccountId) => api.post(`/personal/payroll/${id}/pay`, { treasuryAccountId }),
};

export const employeeExpensesApi = {
  list: (query) => api.get('/personal/expenses', query),
  getOne: (id) => api.get(`/personal/expenses/${id}`),
  register: (data) => api.post('/personal/expenses', data),
  decide: (id, decision, rejectionReason) => api.post(`/personal/expenses/${id}/decide`, { decision, rejectionReason }),
  reimburse: (id, treasuryAccountId) => api.post(`/personal/expenses/${id}/reimburse`, { treasuryAccountId }),
};

export const personalSettingsApi = {
  get: () => api.get('/personal/settings'),
  update: (data) => api.patch('/personal/settings', data),
};

export const personalDashboardApi = {
  get: () => api.get('/personal/dashboard'),
};

// Bug real: el gate de Tesorería (ADMIN/COLLABORATOR) no deja pasar a
// Financiero, que sí puede pagar nómina/reembolsar gastos dentro de
// Personal — este endpoint vive bajo /personal, no bajo /treasury.
export const personalTreasuryAccountsApi = {
  list: () => api.get('/personal/treasury-accounts'),
};
