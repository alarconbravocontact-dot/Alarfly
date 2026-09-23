import { api } from './client';

export const juntaApi = {
  listMessages: () => api.get('/junta/messages'),
  unreadCount: () => api.get('/junta/messages/unread-count'),
  createMessage: (data) => api.post('/junta/messages', data),
  getFile: (id) => api.get(`/junta/messages/${id}/file`),
  markAsRead: (id) => api.post(`/junta/messages/${id}/read`),
};
