import { api } from './client';

export const notificationsApi = {
  list: (query) => api.get('/notifications', query),
  acknowledge: (id) => api.post(`/notifications/${id}/acknowledge`),
};
