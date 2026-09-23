import { api } from './client';

export const inventorySettingsApi = {
  get: () => api.get('/inventory/settings'),
  update: (data) => api.patch('/inventory/settings', data),
};

export const unitsOfMeasureApi = {
  list: () => api.get('/inventory/units-of-measure'),
  create: (data) => api.post('/inventory/units-of-measure', data),
};

export const productCategoriesApi = {
  list: () => api.get('/inventory/categories'),
  create: (data) => api.post('/inventory/categories', data),
};

export const warehousesApi = {
  list: (query) => api.get('/inventory/warehouses', query),
  getOne: (id) => api.get(`/inventory/warehouses/${id}`),
  create: (data) => api.post('/inventory/warehouses', data),
  update: (id, data) => api.patch(`/inventory/warehouses/${id}`, data),
};

export const productsApi = {
  list: (query) => api.get('/inventory/products', query),
  getOne: (id) => api.get(`/inventory/products/${id}`),
  create: (data) => api.post('/inventory/products', data),
  update: (id, data) => api.patch(`/inventory/products/${id}`, data),
  addVariant: (id, data) => api.post(`/inventory/products/${id}/variants`, data),
};

export const inventoryMovementsApi = {
  list: (query) => api.get('/inventory/movements', query),
  createEntry: (data) => api.post('/inventory/movements/entries', data),
  createExit: (data) => api.post('/inventory/movements/exits', data),
  createAdjustment: (data) => api.post('/inventory/movements/adjustments', data),
};

export const transfersApi = {
  list: () => api.get('/inventory/transfers'),
  getOne: (id) => api.get(`/inventory/transfers/${id}`),
  create: (data) => api.post('/inventory/transfers', data),
};

export const physicalCountsApi = {
  list: (query) => api.get('/inventory/physical-counts', query),
  getOne: (id) => api.get(`/inventory/physical-counts/${id}`),
  start: (data) => api.post('/inventory/physical-counts', data),
  submit: (id, lines) => api.post(`/inventory/physical-counts/${id}/submit`, { lines }),
  approve: (id) => api.post(`/inventory/physical-counts/${id}/approve`),
  reject: (id, rejectionReason) => api.post(`/inventory/physical-counts/${id}/reject`, { rejectionReason }),
};

export const stockLevelsApi = {
  list: (query) => api.get('/inventory/stock-levels', query),
  valuation: (query) => api.get('/inventory/stock-levels/valuation', query),
};

export const purchaseOrdersApi = {
  list: (query) => api.get('/inventory/purchase-orders', query),
  getOne: (id) => api.get(`/inventory/purchase-orders/${id}`),
  create: (data) => api.post('/inventory/purchase-orders', data),
  submit: (id) => api.post(`/inventory/purchase-orders/${id}/submit`),
  receive: (id, data) => api.post(`/inventory/purchase-orders/${id}/receive`, data),
  cancel: (id) => api.post(`/inventory/purchase-orders/${id}/cancel`),
  scan: () => api.post('/inventory/purchase-orders/scan'),
};

export const lotsApi = {
  list: (query) => api.get('/inventory/lots', query),
  getTrace: (id) => api.get(`/inventory/lots/${id}/trace`),
};
