import { api } from './client';

export const salesOrdersApi = {
  list: (query) => api.get('/sales/orders', query),
  getOne: (id) => api.get(`/sales/orders/${id}`),
  create: (data) => api.post('/sales/orders', data),
  confirm: (id) => api.post(`/sales/orders/${id}/confirm`),
  cancel: (id, reason) => api.post(`/sales/orders/${id}/cancel`, { reason }),
};

export const salesDeliveriesApi = {
  list: (query) => api.get('/sales/deliveries', query),
  getOne: (id) => api.get(`/sales/deliveries/${id}`),
  create: (data) => api.post('/sales/deliveries', data),
  confirm: (id) => api.post(`/sales/deliveries/${id}/confirm`),
  cancel: (id, reason) => api.post(`/sales/deliveries/${id}/cancel`, { reason }),
};

export const quickSaleApi = {
  create: (data) => api.post('/sales/quick-sale', data),
};

export const paymentMethodsApi = {
  list: (query) => api.get('/payment-methods', query),
};
