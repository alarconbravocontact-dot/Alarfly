import { api } from './client';

export const savedViewsApi = {
  list: (tableKey) => api.get('/saved-views', { tableKey }),
  create: (data) => api.post('/saved-views', data),
  get: (id) => api.get(`/saved-views/${id}`),
  remove: (id) => api.delete(`/saved-views/${id}`),
};
