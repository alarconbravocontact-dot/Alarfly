import { api } from './client';

export const importTemplatesApi = {
  list: (targetKey) => api.get('/import-templates', { targetKey }),
  create: (data) => api.post('/import-templates', data),
  remove: (id) => api.delete(`/import-templates/${id}`),
};
