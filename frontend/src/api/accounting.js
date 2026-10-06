import { api } from './client';

export const accountsApi = {
  tree: () => api.get('/accounting/accounts/tree'),
  list: (query) => api.get('/accounting/accounts', query),
  getOne: (id) => api.get(`/accounting/accounts/${id}`),
  create: (data) => api.post('/accounting/accounts', data),
  update: (id, data) => api.patch(`/accounting/accounts/${id}`, data),
  remove: (id) => api.delete(`/accounting/accounts/${id}`),
};

// El servicio (`core/dimensions`) y la ruta ya existían desde Fase 1,
// usados internamente por Tesorería/Inventario (branchDimensionId) —
// nunca habían tenido su propio cliente HTTP en el frontend porque
// ninguna pantalla hasta ahora necesitaba que el usuario ELIGIERA una
// sucursal desde un selector (Personal es la primera).
export const dimensionsApi = {
  list: (type) => api.get('/accounting/dimensions', { type }),
};

// F17-E2: el servicio ya existía completo desde el primer día del
// proyecto (es lo que usa `prisma/seed.js` para armar el plan de
// cuentas de la empresa demo) pero nunca había tenido ninguna
// pantalla — una empresa nueva real, creada fuera del seed, no tenía
// ninguna forma de conseguir un plan de cuentas sin crear cada cuenta
// a mano, una por una.
export const accountTemplatesApi = {
  list: () => api.get('/accounting/account-templates'),
  apply: (templateId) => api.post(`/accounting/account-templates/${templateId}/apply`),
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

// Fase 6: el backend (core/fx) ya existía completo desde antes
// (registrar/listar tasas, revaluar cuentas en moneda extranjera) pero
// no tenía ninguna pantalla — esta pieza solo lo conecta.
export const fxRatesApi = {
  list: (currency) => api.get('/accounting/fx/rates', currency ? { currency } : undefined),
  record: (data) => api.post('/accounting/fx/rates', data),
  revalue: (asOfDate) => api.post('/accounting/fx/revalue', asOfDate ? { asOfDate } : {}),
};
