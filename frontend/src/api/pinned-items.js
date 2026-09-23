import { api } from './client';

export const pinnedItemsApi = {
  list: () => api.get('/pinned-items'),
  pin: (path, label) => api.post('/pinned-items', { path, label }),
  unpin: (id) => api.delete(`/pinned-items/${id}`),
  recordVisit: (path) => api.post('/pinned-items/visit', { path }),
};
